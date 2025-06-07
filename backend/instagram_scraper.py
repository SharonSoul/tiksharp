import os
import time
import random
import json
import uuid
import logging
from pathlib import Path
from urllib.parse import urlparse
import re
from datetime import datetime

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from fake_useragent import UserAgent
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class InstagramScraper:
    def __init__(self):
        self.upload_folder = Path(__file__).parent.parent / 'uploads'
        self.upload_folder.mkdir(parents=True, exist_ok=True)
        self.proxy_url = os.getenv('PROXY_URL')
        self.instagram_cookies = os.getenv('INSTAGRAM_COOKIES', '')
        self.ua = UserAgent()
        self.driver = None
        self.wait_time = random.uniform(2, 4)

    def _setup_driver(self):
        """Initialize undetected-chromedriver with anti-detection measures"""
        try:
            options = uc.ChromeOptions()
            # Remove headless mode for better reliability
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            options.add_argument('--disable-notifications')
            options.add_argument('--disable-popup-blocking')
            options.add_argument(f'user-agent={self.ua.random}')
            
            if self.proxy_url:
                options.add_argument(f'--proxy-server={self.proxy_url}')
            
            self.driver = uc.Chrome(options=options)
            self.driver.set_window_size(1920, 1080)
            
            if self.instagram_cookies:
                self._add_cookies()
            
            return True
        except Exception as e:
            logger.error(f'Error setting up driver: {str(e)}')
            return False

    def _add_cookies(self):
        """Add Instagram cookies to the browser session"""
        try:
            self.driver.get('https://www.instagram.com')
            time.sleep(self.wait_time)
            
            # Parse cookies string into individual cookies
            cookies = []
            for cookie in self.instagram_cookies.split(';'):
                if '=' in cookie:
                    name, value = cookie.strip().split('=', 1)
                    cookies.append({
                        'name': name,
                        'value': value,
                        'domain': '.instagram.com'
                    })
            
            # Add each cookie individually
            for cookie in cookies:
                try:
                    self.driver.add_cookie(cookie)
                except Exception as e:
                    logger.warning(f'Failed to add cookie {cookie["name"]}: {str(e)}')
            
            # Refresh page to apply cookies
            self.driver.refresh()
            time.sleep(self.wait_time)
            
        except Exception as e:
            logger.error(f'Error adding cookies: {str(e)}')

    def _human_like_delay(self):
        """Add random delays to mimic human behavior"""
        time.sleep(random.uniform(1, 3))

    def _scroll_like_human(self):
        """Scroll the page in a human-like manner"""
        try:
            total_height = self.driver.execute_script("return document.body.scrollHeight")
            viewport_height = self.driver.execute_script("return window.innerHeight")
            current_position = 0
            
            while current_position < total_height:
                scroll_amount = random.randint(100, 300)
                current_position += scroll_amount
                self.driver.execute_script(f"window.scrollTo(0, {current_position});")
                time.sleep(random.uniform(0.1, 0.3))
        except Exception as e:
            logger.warning(f'Error during scrolling: {str(e)}')

    def _extract_media_urls_from_page(self, url, media_type):
        """Extract media URLs from the page using multiple methods"""
        try:
            self.driver.get(url)
            self._human_like_delay()
            self._scroll_like_human()
            
            media_urls = []
            
            # Method 1: Extract from meta tags
            try:
                meta_tags = self.driver.find_elements(By.TAG_NAME, 'meta')
                for tag in meta_tags:
                    if tag.get_attribute('property') == 'og:image':
                        media_urls.append(tag.get_attribute('content'))
                    elif tag.get_attribute('property') == 'og:video':
                        media_urls.append(tag.get_attribute('content'))
            except Exception as e:
                logger.warning(f'Error extracting from meta tags: {str(e)}')

            # Method 2: Extract from script tags
            try:
                scripts = self.driver.find_elements(By.TAG_NAME, 'script')
                for script in scripts:
                    script_content = script.get_attribute('innerHTML')
                    if script_content:
                        # Look for image URLs in the script content
                        image_urls = re.findall(r'https?://[^\s<>"]+?\.(?:jpg|jpeg|png|mp4)', script_content)
                        media_urls.extend(image_urls)
            except Exception as e:
                logger.warning(f'Error extracting from script tags: {str(e)}')

            # Method 3: Extract from img and video tags
            try:
                if media_type == 'post':
                    # For posts, look for carousel items
                    carousel_items = self.driver.find_elements(By.CSS_SELECTOR, 'img[src*="instagram"]')
                    for item in carousel_items:
                        src = item.get_attribute('src')
                        if src and src not in media_urls:
                            media_urls.append(src)
            except Exception as e:
                logger.warning(f'Error extracting from img/video tags: {str(e)}')

            # Filter and deduplicate URLs
            valid_urls = []
            for url in media_urls:
                if url and url.startswith('http') and any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png', '.mp4']):
                    valid_urls.append(url)
            
            return list(set(valid_urls))

        except Exception as e:
            logger.error(f'Error extracting media URLs: {str(e)}')
            return []

    def _download_media(self, url, output_path):
        """Download media with retries and proper headers"""
        headers = {
            'User-Agent': self.ua.random,
            'Referer': 'https://www.instagram.com/',
            'Accept': 'image/jpeg,image/png,video/mp4;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
        
        if self.instagram_cookies:
            headers['Cookie'] = self.instagram_cookies

        proxies = {'http': self.proxy_url, 'https': self.proxy_url} if self.proxy_url else None

        for attempt in range(3):
            try:
                time.sleep(random.uniform(1, 2))
                response = requests.get(url, headers=headers, proxies=proxies, stream=True, timeout=10)
                if response.status_code == 200:
                    with open(output_path, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                    return True
            except Exception as e:
                logger.error(f'Download attempt {attempt + 1} failed: {str(e)}')
                if attempt == 2:
                    raise e
        return False

    def scrape_media(self, url, media_type):
        """Main method to scrape media from Instagram"""
        try:
            if not self._setup_driver():
                raise Exception('Failed to setup Chrome driver')

            media_urls = self._extract_media_urls_from_page(url, media_type)

            if not media_urls:
                raise Exception(f'No media found for {media_type}')

            output_dir = self.upload_folder / f'{media_type}_{uuid.uuid4()}'
            output_dir.mkdir(parents=True, exist_ok=True)
            downloaded_files = []

            for i, media_url in enumerate(media_urls):
                ext = 'mp4' if media_url.endswith('.mp4') else 'jpg'
                output_path = output_dir / f'media_{i + 1}.{ext}'
                
                if self._download_media(media_url, output_path):
                    file_stats = output_path.stat()
                    if file_stats.st_size > 0:
                        relative_path = f'/uploads/{output_dir.name}/media_{i + 1}.{ext}'
                        downloaded_files.append({
                            'url': relative_path,
                            'filename': f'media_{i + 1}.{ext}',
                            'type': 'video' if ext == 'mp4' else 'image'
                        })

            if not downloaded_files:
                output_dir.rmdir()
                raise Exception(f'No valid media downloaded for {media_type}')

            return downloaded_files

        except Exception as e:
            logger.error(f'Error in scrape_media: {str(e)}')
            raise e

        finally:
            if self.driver:
                try:
                    self.driver.quit()
                except:
                    pass

    def __del__(self):
        """Cleanup when the object is destroyed"""
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass 