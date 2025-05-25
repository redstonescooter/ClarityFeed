#!/bin/bash
source ../.env

# Run the scraper
node "${ROOT_FS_ABS%/}/twitter_scraper_playwright/scrape.js"

