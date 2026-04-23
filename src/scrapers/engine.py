from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import time

class ScraperEngine:
    def __init__(self):
        self.playwright = None
        self.browser = None
        self.context = None
        
    def start(self):
        self.playwright = sync_playwright().start()
        # Launching in non-headless mode is sometimes necessary to bypass strong Cloudflare
        # but for automation we try headless=False first if issues arise, otherwise headless=True
        # We will use headless=True by default, but override if needed.
        self.browser = self.playwright.chromium.launch(headless=True)
        # Adding some headers and a real user agent helps bypass protections
        self.context = self.browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}
        )

    def stop(self):
        if self.context:
            self.context.close()
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()

    def get_page_content(self, url, wait_for_selector=None, delay=2):
        """Fetches a page, waits for it to load, and returns the HTML content."""
        page = self.context.new_page()
        try:
            print(f"Loading {url}...")
            # Wait until there are no more than 2 network connections for at least 500 ms.
            page.goto(url, wait_until="networkidle", timeout=60000)
            
            # Simple Cloudflare check: if title contains "Just a moment"
            if "Just a moment" in page.title() or "Cloudflare" in page.title():
                print("Cloudflare detected, waiting...")
                time.sleep(10) # Wait for challenge to complete
            
            if wait_for_selector:
                try:
                    page.wait_for_selector(wait_for_selector, timeout=10000)
                except Exception as e:
                    print(f"Timeout waiting for selector {wait_for_selector}: {e}")
            
            # Wait an additional small delay for dynamic content
            time.sleep(delay)
            
            content = page.content()
            return content
        except Exception as e:
            print(f"Error loading {url}: {e}")
            return None
        finally:
            page.close()

    def parse_html(self, html):
        """Returns a BeautifulSoup object from HTML."""
        if not html:
            return None
        return BeautifulSoup(html, 'html.parser')
