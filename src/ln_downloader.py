from src.scrapers.engine import ScraperEngine
from src.scrapers.parsers import get_parser
from src.utils.history import HistoryTracker
from src.google_api.drive_client import GoogleDriveAPI

class LNDownloader:
    def __init__(self, drive_api: GoogleDriveAPI, engine: ScraperEngine, history: HistoryTracker):
        self.drive_api = drive_api
        self.engine = engine
        self.history = history

    def process_toc(self, toc_url, ln_folder_id):
        print(f"\nProcessing Light Novel ToC: {toc_url}")
        html = self.engine.get_page_content(toc_url)
        if not html:
            print("Failed to load ToC page.")
            return

        parser = get_parser(toc_url)
        title = parser.get_title(html)
        
        # Clean up title for folder name
        safe_title = "".join([c for c in title if c.isalpha() or c.isdigit() or c==' ']).rstrip()
        
        # Create series folder inside Light Novels folder
        series_folder_id = self.drive_api.get_or_create_folder(safe_title, ln_folder_id)
        
        chapters = parser.get_chapters_list(html, toc_url)
        print(f"Found {len(chapters)} chapters for '{safe_title}'.")

        for i, chapter_url in enumerate(chapters):
            if self.history.is_chapter_downloaded(toc_url, chapter_url):
                print(f"Skipping already downloaded chapter: {chapter_url}")
                continue
                
            print(f"Downloading chapter {i+1}/{len(chapters)}: {chapter_url}")
            self.download_chapter(chapter_url, series_folder_id)
            self.history.mark_chapter_downloaded(toc_url, chapter_url)

    def download_chapter(self, chapter_url, series_folder_id):
        html = self.engine.get_page_content(chapter_url)
        if not html:
            print(f"Failed to load chapter: {chapter_url}")
            return
            
        parser = get_parser(chapter_url)
        title = parser.get_title(html)
        content = parser.extract_ln_content(html)
        
        if not content:
            print(f"Warning: No content found for {chapter_url}")
            return
            
        self.drive_api.create_google_doc(title, content, series_folder_id)
