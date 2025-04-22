#!/bin/bash
source ../.env

# Run the scraper
bun "${ROOT_FS_ABS%/}/twitter_scraper_playwright/scrape.js"

