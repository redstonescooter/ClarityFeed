# Define here the models for your scraped items
#
# See documentation in:
# https://docs.scrapy.org/en/latest/topics/items.html

import scrapy


class TwitterScraperItem(scrapy.Item):
    # define the fields for your item here like:
    # name = scrapy.Field()
    pass

class TweetItem(scrapy.Item):
    text = scrapy.Field()
    timestamp = scrapy.Field()
    likes = scrapy.Field()
    retweets = scrapy.Field()
