from urllib.parse import urljoin
from bs4 import BeautifulSoup
import re

class SiteParser:
    """Base class for site-specific parsers."""
    def get_chapters_list(self, html, base_url):
        raise NotImplementedError

    def extract_ln_content(self, html):
        raise NotImplementedError
        
    def extract_manga_images(self, html):
        raise NotImplementedError

    def get_title(self, html):
        soup = BeautifulSoup(html, 'html.parser')
        title_tag = soup.find('title')
        if title_tag:
            return title_tag.text.strip()
        return "Unknown Title"


class SHMTranslationsParser(SiteParser):
    # For https://www.shmtranslations.com/ongoing/farming-life-in-another-world/
    def get_chapters_list(self, html, base_url):
        soup = BeautifulSoup(html, 'html.parser')
        chapters = []
        # Usually chapters are in an unordered list or divs
        # For SHM Translations, let's look for links that look like chapter links
        for a in soup.find_all('a', href=True):
            href = a['href']
            # Very basic check: if it's a link to a chapter
            if 'chapter' in href.lower() and base_url in href:
                chapters.append(href)
        
        # Sometimes there's a specific class. If this fails, we can refine it.
        # Removing duplicates while preserving order
        return list(dict.fromkeys(chapters))

    def extract_ln_content(self, html):
        soup = BeautifulSoup(html, 'html.parser')
        # Typical WordPress content div
        content_div = soup.find('div', class_='entry-content')
        if not content_div:
            return ""
        
        # Extract text, removing scripts and styles
        for script in content_div(["script", "style"]):
            script.decompose()
            
        text = content_div.get_text(separator='\n\n')
        # Clean up excessive newlines
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()


class ScanMangaParser(SiteParser):
    # For https://www.scan-manga.com/
    def get_chapters_list(self, html, base_url):
        soup = BeautifulSoup(html, 'html.parser')
        chapters = []
        # Scan-manga chapters list
        # Assuming the base URL is the manga page
        links = soup.select('div.chapitre_nom a')
        for a in links:
            href = a.get('href')
            if href:
                full_url = urljoin(base_url, href)
                chapters.append(full_url)
        return list(dict.fromkeys(chapters))

    def extract_manga_images(self, html):
        soup = BeautifulSoup(html, 'html.parser')
        images = []
        # Usually inside a specific container
        img_tags = soup.select('div#page_b img') # Example, needs actual verification
        if not img_tags:
             # Fallback
             img_tags = soup.find_all('img', class_='scan-page')
             
        for img in img_tags:
            src = img.get('data-src') or img.get('src')
            if src:
                images.append(src)
        return images

class PoseidonScansParser(SiteParser):
    # For https://poseidon-scans.net/
    def get_chapters_list(self, html, base_url):
        soup = BeautifulSoup(html, 'html.parser')
        chapters = []
        links = soup.select('li.wp-manga-chapter a')
        for a in links:
            href = a.get('href')
            if href:
                chapters.append(href)
        # Manga sites usually list newest first, let's reverse to get oldest first
        chapters.reverse()
        return list(dict.fromkeys(chapters))

    def extract_manga_images(self, html):
        soup = BeautifulSoup(html, 'html.parser')
        images = []
        img_tags = soup.select('div.page-break img')
        for img in img_tags:
            src = img.get('data-src') or img.get('src')
            if src:
                images.append(src.strip())
        return images

def get_parser(url):
    if 'shmtranslations.com' in url:
        return SHMTranslationsParser()
    elif 'scan-manga.com' in url:
        return ScanMangaParser()
    elif 'poseidon-scans.net' in url:
        return PoseidonScansParser()
    else:
        # Default parser or None
        return SiteParser()
