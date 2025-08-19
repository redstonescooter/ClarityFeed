#!/bin/bash
source ../.env
bun run build

# Run the scraper
bun run "${ROOT_FS_ABS%/}/twitter_scraper_playwright/scrape.js"

