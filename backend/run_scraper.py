import sys
import json
from instagram_scraper import InstagramScraper

def main():
    if len(sys.argv) != 3:
        print(json.dumps({'error': 'Invalid arguments. Usage: python run_scraper.py <url> <media_type>'}))
        sys.exit(1)

    url = sys.argv[1]
    media_type = sys.argv[2]

    if media_type not in ['post', 'story']:
        print(json.dumps({'error': 'Invalid media type. Must be either "post" or "story"'}))
        sys.exit(1)

    try:
        scraper = InstagramScraper()
        media_files = scraper.scrape_media(url, media_type)
        print(json.dumps(media_files))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main() 