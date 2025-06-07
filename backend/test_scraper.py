import sys
import json
from instagram_scraper import InstagramScraper

def test_scraper():
    # Test URLs
    test_urls = {
        'post': 'https://www.instagram.com/p/your_post_url',  # Replace with a real post URL
        'story': 'https://www.instagram.com/stories/username/story_id'  # Replace with a real story URL
    }

    scraper = InstagramScraper()

    for media_type, url in test_urls.items():
        print(f"\nTesting {media_type} scraping...")
        try:
            results = scraper.scrape_media(url, media_type)
            print(f"Successfully scraped {media_type}:")
            print(json.dumps(results, indent=2))
        except Exception as e:
            print(f"Error scraping {media_type}: {str(e)}")

if __name__ == '__main__':
    test_scraper() 