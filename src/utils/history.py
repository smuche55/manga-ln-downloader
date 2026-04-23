import json
import os

class HistoryTracker:
    def __init__(self, history_file='history.json'):
        self.history_file = history_file
        self.data = self._load_history()

    def _load_history(self):
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                print("Error reading history.json. Creating a new one.")
                return {}
        return {}

    def _save_history(self):
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, indent=4)

    def is_chapter_downloaded(self, series_url, chapter_url):
        """Checks if a chapter has already been downloaded for a specific series."""
        if series_url not in self.data:
            return False
        return chapter_url in self.data[series_url].get('chapters', [])

    def mark_chapter_downloaded(self, series_url, chapter_url):
        """Marks a chapter as downloaded and saves the state."""
        if series_url not in self.data:
            self.data[series_url] = {'chapters': []}
        
        if chapter_url not in self.data[series_url]['chapters']:
            self.data[series_url]['chapters'].append(chapter_url)
            self._save_history()
            
    def get_downloaded_chapters(self, series_url):
        if series_url not in self.data:
            return []
        return self.data[series_url].get('chapters', [])
