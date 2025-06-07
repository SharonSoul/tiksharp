import json
import httpx
import asyncio
import logging
import sys
from urllib.parse import quote
from typing import Optional, List, Dict, Any
from pathlib import Path
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging to file instead of stdout
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    filename='instagram_scraper.log',
    filemode='a'
)
logger = logging.getLogger(__name__)

class InstagramGraphQLScraper:
    INSTAGRAM_ACCOUNT_DOCUMENT_ID = "9310670392322965"
    
    def __init__(self):
        self.upload_folder = Path(__file__).parent.parent / 'uploads'
        self.upload_folder.mkdir(parents=True, exist_ok=True)
        self.instagram_cookies = os.getenv('INSTAGRAM_COOKIES', '')
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'X-Requested-With': 'XMLHttpRequest',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'TE': 'trailers',
        }
        
        if self.instagram_cookies:
            self.headers['Cookie'] = self.instagram_cookies

    async def _make_request(self, session: httpx.AsyncClient, variables: Dict[str, Any]) -> Dict[str, Any]:
        """Make a GraphQL request to Instagram"""
        base_url = "https://www.instagram.com/graphql/query"
        body = f"variables={quote(json.dumps(variables, separators=(',', ':')))}&doc_id={self.INSTAGRAM_ACCOUNT_DOCUMENT_ID}"
        
        try:
            response = await session.post(
                base_url,
                data=body,
                headers=self.headers,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error making request: {str(e)}")
            raise

    async def scrape_user_posts(self, username: str, page_size: int = 12, max_pages: Optional[int] = None) -> List[Dict[str, Any]]:
        """Scrape all posts of an Instagram user given the username"""
        variables = {
            "after": None,
            "before": None,
            "data": {
                "count": page_size,
                "include_reel_media_seen_timestamp": True,
                "include_relationship_info": True,
                "latest_besties_reel_media": True,
                "latest_reel_media": True
            },
            "first": page_size,
            "last": None,
            "username": username,
            "__relay_internal__pv__PolarisIsLoggedInrelayprovider": True,
            "__relay_internal__pv__PolarisShareSheetV3relayprovider": True
        }

        prev_cursor = None
        _page_number = 1
        all_posts = []

        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as session:
            while True:
                try:
                    data = await self._make_request(session, variables)
                    
                    # Save raw response for debugging
                    debug_file = self.upload_folder / f"debug_{username}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                    with open(debug_file, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)

                    posts = data.get("data", {}).get("xdt_api__v1__feed__user_timeline_graphql_connection", {})
                    if not posts:
                        logger.error(f"No posts found in response: {data}")
                        break

                    for post in posts.get("edges", []):
                        all_posts.append(post["node"])

                    page_info = posts.get("page_info", {})
                    if not page_info.get("has_next_page"):
                        logger.info(f"Reached last page ({_page_number})")
                        break

                    if page_info.get("end_cursor") == prev_cursor:
                        logger.info("No new posts found, breaking")
                        break

                    prev_cursor = page_info["end_cursor"]
                    variables["after"] = page_info["end_cursor"]
                    _page_number += 1

                    if max_pages and _page_number > max_pages:
                        logger.info(f"Reached maximum page limit ({max_pages})")
                        break

                    # Add delay between requests
                    await asyncio.sleep(2)

                except Exception as e:
                    logger.error(f"Error scraping page {_page_number}: {str(e)}")
                    break

        return all_posts

    async def scrape_post(self, post_url: str) -> Dict[str, Any]:
        """Scrape a single post using its URL"""
        try:
            # Extract username and post ID from URL
            # Example URL: https://www.instagram.com/p/ABC123/
            post_id = post_url.split('/p/')[1].split('/')[0]
            
            async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as session:
                # First, get the post page to extract the username
                response = await session.get(post_url, headers=self.headers)
                response.raise_for_status()
                
                # Extract username from the page
                # This is a simplified version - you might need to adjust based on actual page structure
                username = None
                if 'og:title' in response.text:
                    username = response.text.split('og:title" content="')[1].split(' on Instagram')[0]
                
                if not username:
                    raise Exception("Could not extract username from post URL")
                
                # Now scrape the user's posts to find the specific post
                posts = await self.scrape_user_posts(username, max_pages=1)
                
                # Find the specific post
                for post in posts:
                    if post.get('shortcode') == post_id:
                        return post
                
                raise Exception(f"Post {post_id} not found in user's posts")
                
        except Exception as e:
            logger.error(f"Error scraping post: {str(e)}")
            raise

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No URL provided"}))
        return

    url = sys.argv[1]
    scraper = InstagramGraphQLScraper()
    
    try:
        post_data = await scraper.scrape_post(url)
        print(json.dumps(post_data))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())   