import os
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import time

def get_instagram_cookies():
    print("Starting browser to get Instagram cookies...")
    print("Please log in to Instagram when the browser opens.")
    print("After logging in, the script will automatically extract your cookies.")
    print("DO NOT close the browser window - the script will close it automatically.")
    
    # Setup Chrome options
    chrome_options = Options()
    chrome_options.add_argument("--start-maximized")
    
    # Initialize the driver
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    
    try:
        # Go to Instagram
        driver.get("https://www.instagram.com")
        
        # Wait for user to log in
        input("Press Enter after you have logged in to Instagram...")
        
        # Get cookies
        cookies = driver.get_cookies()
        
        # Format cookies for .env file
        cookie_string = "; ".join([f"{cookie['name']}={cookie['value']}" for cookie in cookies])
        
        # Create .env file
        with open(".env", "w") as f:
            f.write(f"INSTAGRAM_COOKIES={cookie_string}\n")
        
        print("\nCookies have been saved to .env file!")
        print("You can now use the Instagram scraper.")
        
    except Exception as e:
        print(f"An error occurred: {str(e)}")
    
    finally:
        # Close the browser
        driver.quit()

if __name__ == "__main__":
    get_instagram_cookies() 