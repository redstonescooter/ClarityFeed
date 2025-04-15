# Twitter Feed Scraper

This project uses Scrapy and Playwright to scrape the last 10 tweets from your Twitter feed.

## Setup

1. Install the required dependencies:
```bash
pip install -r requirements.txt
```

2. Install Playwright browsers:
```bash
playwright install
```

3. Create a `.env` file with your Twitter credentials:
```
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
```

## Usage

Run the spider with:
```bash
scrapy crawl twitter_feed
```

The tweets will be saved in `tweets.json` in the following format:
```json
{
    "text": "Tweet content",
    "timestamp": "Tweet timestamp",
    "likes": "Number of likes",
    "retweets": "Number of retweets"
}
``` 