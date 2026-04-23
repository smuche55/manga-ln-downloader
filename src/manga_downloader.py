import os
import requests
import zipfile
import shutil
from src.scrapers.engine import ScraperEngine
from src.scrapers.parsers import get_parser
from src.utils.history import HistoryTracker
from src.google_api.drive_client import GoogleDriveAPI
from urllib.parse import urlparse

class MangaDownloader:
    def __init__(self, drive_api: GoogleDriveAPI, engine: ScraperEngine, history: HistoryTracker):
        self.drive_api = drive_api
        self.engine = engine
        self.history = history
        self.temp_dir = "temp_manga"
        
        if not os.path.exists(self.temp_dir):
            os.makedirs(self.temp_dir)

    def process_toc(self, toc_url, manga_folder_id):
        print(f"\nProcessing Manga ToC: {toc_url}")
        html = self.engine.get_page_content(toc_url)
        if not html:
            print("Failed to load ToC page.")
            return

        parser = get_parser(toc_url)
        title = parser.get_title(html)
        safe_title = "".join([c for c in title if c.isalpha() or c.isdigit() or c==' ']).rstrip()
        
        series_folder_id = self.drive_api.get_or_create_folder(safe_title, manga_folder_id)
        
        chapters = parser.get_chapters_list(html, toc_url)
        print(f"Found {len(chapters)} chapters for '{safe_title}'.")

        for i, chapter_url in enumerate(chapters):
            if self.history.is_chapter_downloaded(toc_url, chapter_url):
                print(f"Skipping already downloaded chapter: {chapter_url}")
                continue
                
            print(f"Downloading chapter {i+1}/{len(chapters)}: {chapter_url}")
            success = self.download_chapter(chapter_url, series_folder_id, f"Chapter_{i+1}")
            if success:
                self.history.mark_chapter_downloaded(toc_url, chapter_url)

    def download_chapter(self, chapter_url, series_folder_id, chapter_name):
        html = self.engine.get_page_content(chapter_url)
        if not html:
            print(f"Failed to load chapter: {chapter_url}")
            return False
            
        parser = get_parser(chapter_url)
        image_urls = parser.extract_manga_images(html)
        
        if not image_urls:
            print(f"Warning: No images found for {chapter_url}")
            return False
            
        print(f"Found {len(image_urls)} images.")
        
        chapter_dir = os.path.join(self.temp_dir, chapter_name)
        if not os.path.exists(chapter_dir):
            os.makedirs(chapter_dir)
            
        # Download images
        for i, img_url in enumerate(image_urls):
            # Try to get extension from URL
            parsed = urlparse(img_url)
            ext = os.path.splitext(parsed.path)[1]
            if not ext:
                ext = '.jpg' # Default
            
            img_path = os.path.join(chapter_dir, f"{i:03d}{ext}")
            
            try:
                # We use simple requests here, assuming image servers don't block direct downloads
                # If they do, we'd need to use Playwright's page.evaluate to fetch blob or use cookies
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": chapter_url
                }
                response = requests.get(img_url, headers=headers, stream=True)
                if response.status_code == 200:
                    with open(img_path, 'wb') as f:
                        for chunk in response.iter_content(1024):
                            f.write(chunk)
                else:
                    print(f"Failed to download image {img_url} (Status: {response.status_code})")
            except Exception as e:
                print(f"Error downloading {img_url}: {e}")

        # Create CBZ
        cbz_filename = f"{chapter_name}.cbz"
        cbz_path = os.path.join(self.temp_dir, cbz_filename)
        
        with zipfile.ZipFile(cbz_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(chapter_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, chapter_dir)
                    zipf.write(file_path, arcname)
                    
        # Upload to Drive
        self.drive_api.upload_file(cbz_path, cbz_filename, 'application/vnd.comicbook+zip', series_folder_id)
        
        # Cleanup
        shutil.rmtree(chapter_dir)
        os.remove(cbz_path)
        return True
