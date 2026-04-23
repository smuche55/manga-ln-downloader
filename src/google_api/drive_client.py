import os
import io
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/documents']

class GoogleDriveAPI:
    def __init__(self, credentials_path='credentials.json', token_path='token.json'):
        self.creds = None
        self.credentials_path = credentials_path
        self.token_path = token_path
        
        # The file token.json stores the user's access and refresh tokens, and is
        # created automatically when the authorization flow completes for the first
        # time.
        if os.path.exists(self.token_path):
            self.creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)
        # If there are no (valid) credentials available, let the user log in.
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                self.creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_path, SCOPES)
                self.creds = flow.run_local_server(port=0)
            # Save the credentials for the next run
            with open(self.token_path, 'w') as token:
                token.write(self.creds.to_json())

        self.drive_service = build('drive', 'v3', credentials=self.creds)
        self.docs_service = build('docs', 'v1', credentials=self.creds)
        
        # Cache for folder IDs
        self.folder_cache = {}

    def get_or_create_folder(self, folder_name, parent_id=None):
        cache_key = f"{folder_name}_{parent_id}"
        if cache_key in self.folder_cache:
            return self.folder_cache[cache_key]

        query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        if parent_id:
            query += f" and '{parent_id}' in parents"
        
        results = self.drive_service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        items = results.get('files', [])

        if not items:
            # Create folder
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            if parent_id:
                file_metadata['parents'] = [parent_id]
            
            folder = self.drive_service.files().create(body=file_metadata, fields='id').execute()
            folder_id = folder.get('id')
            print(f"Created folder: {folder_name} (ID: {folder_id})")
        else:
            folder_id = items[0].get('id')
            #print(f"Found folder: {folder_name} (ID: {folder_id})")
        
        self.folder_cache[cache_key] = folder_id
        return folder_id

    def setup_directories(self):
        """Creates 'Lecture' -> 'Light Novels' and 'Mangas' folders."""
        root_folder_id = self.get_or_create_folder('Lecture')
        ln_folder_id = self.get_or_create_folder('Light Novels', root_folder_id)
        manga_folder_id = self.get_or_create_folder('Mangas', root_folder_id)
        return ln_folder_id, manga_folder_id

    def create_google_doc(self, title, content_text, parent_folder_id):
        """Creates a Google Doc with the given title and text content."""
        # 1. Create a blank Google Doc file in the specific folder
        file_metadata = {
            'name': title,
            'mimeType': 'application/vnd.google-apps.document',
            'parents': [parent_folder_id]
        }
        doc_file = self.drive_service.files().create(body=file_metadata, fields='id').execute()
        document_id = doc_file.get('id')
        
        # 2. Insert text into the Google Doc
        requests = [
            {
                'insertText': {
                    'location': {
                        'index': 1,
                    },
                    'text': content_text
                }
            }
        ]
        
        # We need to handle potential long texts by batching or just sending as one request
        # Google Docs API has a limit of 1MB per request, which is usually fine for a chapter.
        try:
            self.docs_service.documents().batchUpdate(
                documentId=document_id, body={'requests': requests}).execute()
            print(f"Successfully created Google Doc: {title}")
        except Exception as e:
            print(f"Error inserting text into Doc '{title}': {e}")
            # Try splitting into smaller chunks if it fails? For now just print error.
            
        return document_id

    def upload_file(self, file_path, filename, mime_type, parent_folder_id):
        """Uploads a local file to Google Drive."""
        file_metadata = {
            'name': filename,
            'parents': [parent_folder_id]
        }
        
        # Determine the file size to see if it's there
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return None
            
        media = MediaIoBaseUpload(io.FileIO(file_path, 'rb'),
                                mimetype=mime_type,
                                resumable=True)
                                
        file = self.drive_service.files().create(body=file_metadata,
                                            media_body=media,
                                            fields='id').execute()
        print(f"Successfully uploaded {filename} (ID: {file.get('id')})")
        return file.get('id')
