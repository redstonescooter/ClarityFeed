import os
import json
from datetime import datetime
from dotenv import load_dotenv
import scrapy
from scrapy_playwright.page import PageMethod

class TwitterFeedSpider(scrapy.Spider):
    name = 'twitter_feed'
    custom_settings = {
        'DOWNLOAD_HANDLERS': {
            "http": "scrapy_playwright.handler.PlaywrightDownloadHandler",
            "https": "scrapy_playwright.handler.PlaywrightDownloadHandler",
        },
        'PLAYWRIGHT_LAUNCH_OPTIONS': {
            'headless': True,
        },
        'PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT': 60000,
        'FEEDS': {
            'tweets.json': {
                'format': 'json',
                'encoding': 'utf8',
                'store_empty': False,
                'item_classes': ['TweetItem'],
            },
        },
    }

    def start_requests(self):
        load_dotenv()
        username = os.getenv('TWITTER_USERNAME')
        password = os.getenv('TWITTER_PASSWORD')

        if not username or not password:
            self.logger.error('Twitter credentials not found in .env file')
            return

        yield scrapy.Request(
            'https://twitter.com/login',
            meta=dict(
                playwright=True,
                playwright_include_page=True,
                playwright_page_methods=[
                    PageMethod('wait_for_selector', 'input[autocomplete="username"]'),
                    PageMethod('fill', 'input[autocomplete="username"]', username),
                    PageMethod('click', 'div[role="button"]:has-text("Next")'),
                    PageMethod('wait_for_selector', 'input[type="password"]'),
                    PageMethod('fill', 'input[type="password"]', password),
                    PageMethod('click', 'div[role="button"]:has-text("Log in")'),
                    PageMethod('wait_for_selector', 'article[data-testid="tweet"]'),
                ],
                playwright_page_method_kwargs={
                    'wait_for_selector': 'article[data-testid="tweet"]',
                },
            ),
            callback=self.parse_tweets,
        )

    async def parse_tweets(self, response):
        page = response.meta["playwright_page"]
        
        # Wait for tweets to load
        await page.wait_for_selector('article[data-testid="tweet"]')
        
        # Get the last 10 tweets
        tweets = await page.query_selector_all('article[data-testid="tweet"]')
        tweets = tweets[:10]  # Limit to 10 tweets
        
        for tweet in tweets:
            try:
                # Extract tweet text
                text_element = await tweet.query_selector('div[data-testid="tweetText"]')
                text = await text_element.inner_text() if text_element else ""

                # Extract timestamp
                time_element = await tweet.query_selector('time')
                timestamp = await time_element.get_attribute('datetime') if time_element else ""

                # Extract engagement metrics
                likes_element = await tweet.query_selector('div[data-testid="like"]')
                likes = await likes_element.inner_text() if likes_element else "0"

                retweets_element = await tweet.query_selector('div[data-testid="retweet"]')
                retweets = await retweets_element.inner_text() if retweets_element else "0"

                yield {
                    'text': text,
                    'timestamp': timestamp,
                    'likes': likes,
                    'retweets': retweets,
                }
            except Exception as e:
                self.logger.error(f'Error parsing tweet: {str(e)}')

        await page.close() 