import os
import argparse
from src.google_api.drive_client import GoogleDriveAPI
from src.scrapers.engine import ScraperEngine
from src.utils.history import HistoryTracker
from src.ln_downloader import LNDownloader
from src.manga_downloader import MangaDownloader
from dotenv import load_dotenv

def main():
    load_dotenv()
    
    parser = argparse.ArgumentParser(description="Download LN and Manga to Google Drive")
    parser.add_argument('--links', type=str, default='links.txt', help='Path to the text file containing links')
    args = parser.parse_args()

    if not os.path.exists(args.links):
        print(f"File {args.links} not found. Please create it and add your links (one per line).")
        # Create an empty one for the user
        with open(args.links, 'w') as f:
            f.write("# Add your ToC (Table of Contents) links here, one per line.\n")
            f.write("# Examples:\n")
            f.write("# https://www.shmtranslations.com/ongoing/farming-life-in-another-world/\n")
            f.write("# https://poseidon-scans.net/serie/infinite-mage\n")
        return

    # Read links
    with open(args.links, 'r') as f:
        links = [line.strip() for line in f if line.strip() and not line.startswith('#')]

    if not links:
        print("No valid links found in the file.")
        return

    print("Initializing Google Drive API...")
    drive_api = GoogleDriveAPI()
    ln_folder_id, manga_folder_id = drive_api.setup_directories()

    history = HistoryTracker()
    engine = ScraperEngine()
    
    print("Starting Scraper Engine...")
    engine.start()

    ln_downloader = LNDownloader(drive_api, engine, history)
    manga_downloader = MangaDownloader(drive_api, engine, history)

    try:
        for link in links:
            # Very basic routing based on URL
            if 'shmtranslations' in link:
                ln_downloader.process_toc(link, ln_folder_id)
            elif 'scan-manga' in link or 'poseidon-scans' in link:
                manga_downloader.process_toc(link, manga_folder_id)
            else:
                print(f"Unknown site or no parser defined for: {link}")
    except KeyboardInterrupt:
        print("\nProcess interrupted by user.")
    finally:
        print("Stopping Scraper Engine...")
        engine.stop()
        print("Done.")

if __name__ == "__main__":
    main()
