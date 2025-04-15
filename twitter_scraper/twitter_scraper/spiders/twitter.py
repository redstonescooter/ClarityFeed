import os
import json
from datetime import datetime
from dotenv import load_dotenv
import scrapy
from scrapy_playwright.page import PageMethod
from ..items import TweetItem


class TwitterSpider(scrapy.Spider):
    name = 'twitter'
    custom_settings = {
        'DOWNLOAD_HANDLERS': {
            "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
            "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
        },
        'PLAYWRIGHT_LAUNCH_OPTIONS': {
            'headless': True,
            'args': [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
            ],
        },
        'PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT': 60000,
        'ROBOTSTXT_OBEY': False,
        'CONCURRENT_REQUESTS': 1,
        'DOWNLOAD_DELAY': 3,
        'COOKIES_ENABLED': True,
        'FEEDS': {
            'tweets.json': {
                'format': 'json',
                'encoding': 'utf8',
                'store_empty': False,
                'item_classes': ['twitter_scraper.items.TweetItem'],
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

        # Try both x.com and twitter.com
        urls = ['https://x.com/login', 'https://twitter.com/login']
        
        for url in urls:
            try:
                yield scrapy.Request(
                    url,
                    meta=dict(
                        playwright=True,
                        playwright_include_page=True,
                        playwright_page_methods=[
                            PageMethod('wait_for_selector', 'input[autocomplete="username"]', timeout=30000),
                            PageMethod('fill', 'input[autocomplete="username"]', username),
                            PageMethod('click', 'div[role="button"]:has-text("Next")'),
                            PageMethod('wait_for_selector', 'input[type="password"]', timeout=30000),
                            PageMethod('fill', 'input[type="password"]', password),
                            PageMethod('click', 'div[role="button"]:has-text("Log in")'),
                            PageMethod('wait_for_selector', 'article[data-testid="tweet"]', timeout=30000),
                        ],
                        playwright_page_method_kwargs={
                            'wait_for_selector': 'article[data-testid="tweet"]',
                            'timeout': 30000,
                        },
                        playwright_context_kwargs={
                            'viewport': {'width': 1920, 'height': 1080},
                            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        },
                    ),
                    callback=self.parse_tweets,
                    errback=self.errback_httpbin,
                )
            except Exception as e:
                self.logger.error(f'Error creating request for {url}: {str(e)}')

    async def errback_httpbin(self, failure):
        page = failure.request.meta["playwright_page"]
        self.logger.error(f'Error during request: {str(failure.value)}')
        await page.close()

    async def parse_tweets(self, response):
        page = response.meta["playwright_page"]
        
        try:
            # Wait for tweets to load
            await page.wait_for_selector('article[data-testid="tweet"]', timeout=30000)
            
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

                    yield TweetItem(
                        text=text,
                        timestamp=timestamp,
                        likes=likes,
                        retweets=retweets,
                    )
                except Exception as e:
                    self.logger.error(f'Error parsing tweet: {str(e)}')

        except Exception as e:
            self.logger.error(f'Error during tweet parsing: {str(e)}')
        finally:
            await page.close()
