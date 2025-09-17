# 🐦 Twitter/X Timeline Scraper

A Playwright-based tool to scrape tweets from your timeline, with support for authentication, persistent profiles, and robust deduplication.

---

## 🏁 Entry Point & Setup

- **Starts with `main()` function**  
- **Loads environment variables** from `.env` file  
- **Gets proxy settings** (🌐 HTTP, HTTPS, SOCKS) — ❌ exits if missing  
- **Parses command-line arguments** via `handleArgs()`:  
  - `--profile/-p`: Browser profile name 👤  
  - `--scroll/-s`: Number of scrolls (default: 5) 🖱️  
  - `--name/-n`: Custom name extension for output files 📝  

---

## 🌐 Browser Initialization

- **`getBrowserConfig()` sets up Playwright browser with:**  
  - Headless: `false` (visible browser 👀)  
  - Proxy configuration 🌍  
  - Profile-based persistent context if profile specified  

- **Launches browser/context** and creates new page 🆕

---

## 🔑 Site Access & Authentication

- **`init()` navigates to:** `https://x.com`  
- 📸 **Takes initial screenshot**  
- **`checkIfLoggedIn()`** checks authentication state by detecting:  
  - ✅ Profile button, timeline column, home tab  
  - ❌ Login button presence  

- If **not logged in** → runs `login()` sequence:  
  - 🔗 Clicks login link  
  - ⌨️ Enters email from `TWITTER_EMAIL`  
  - 🔒 Handles password via `handle_password()`  
  - 📱 Manages suspicious activity check via `handle_confirm_phone()`  

---

## 📰 Tweet Collection Process

**`collectTweetsWithScroll()`** = main scraping loop 🔄  

1. Loads previously seen tweet IDs from `ids.json` 📂  
2. Scrolls timeline up to **maxScrolls** times  
3. For each scroll iteration:  
   - **`getVisibleNewTweets()`** extracts tweets from DOM 🕵️  
   - **`extractTweetInfoPlaywright()`** parses tweet data  
   - Generates unique IDs via `generateTweetId()` 🆔  
   - Filters out already-seen tweets 🚫  
   - **`scrollToLoadMore()`** triggers next batch 🔽  

---

## 🧩 Tweet Data Extraction

**`extractTweetInfoPlaywright()`** runs in browser context to extract:  
- 👤 **Author name & handle**  
- 📝 **Tweet content text**  
- 🔁 **Retweet detection** (via social context or retweet icon)  
- 🖇️ **Quote tweet detection**  
- 🖼️ **Media links** (images, videos)  
- ⏰ **Timestamps & tweet IDs**  

---

## 💾 Output & Persistence

**`outputResults()`** saves collected data:  
- 🗂️ Creates **timestamped JSON files** with all tweets  
- 🔄 Updates `ids.json` with seen tweet IDs  
- 📊 Prints **summary** to console  

---

## ⚙️ Resources & Variables Used

### 🌱 Environment Variables
- `TWITTER_EMAIL`, `TWITTER_PASSWORD`, `TWITTER_USERNAME`, `TWITTER_PHONE`  
- `WSL_PROXY_HTTP/HTTPS/SOCKS` → proxy configuration  
- `ROOT_FS_ABS` → file system root path  
- `PROFILE`, `NAME_EXTENSION` → optional defaults  

### 📁 File System
- `playwright_profiles/` → browser profile storage  
- `output/{profile}/` → results & state storage  
- `ids.json` → seen tweets tracker  
- `tweets_[timestamp]_[name].json` → collected data  

### 📦 External Dependencies
- **Playwright** for browser automation 🤖  
- **Custom utilities:** `Logger`, `security_question_sentiment`  

---

## 🧠 Different Scenarios Handled

### 🔐 Authentication States
- **Profile mode:** Persistent context, skips login if already authenticated  
- **Fresh login:** Full credential-based login flow  
- **Suspicious activity:** Phone/username verification prompts handled  

### 📝 Tweet Types
- 🧾 **Regular tweets:** Standard content extraction  
- 🔁 **Retweets:** Detects original author & content  
- 🖇️ **Quote tweets:** Captures main + quoted content  
- 🖼️ **Media tweets:** Extracts image/video URLs  

### 🛠️ Error Handling
- 🌐 Network timeouts during page loads  
- 🕳️ Missing DOM elements during extraction  
- 📂 File system errors for profile/output directories  
- 🧹 Browser cleanup on exit  

### 🎛️ Collection Control
- Stops after **max scrolls** OR **no new tweets found 3 times** consecutively  
- Deduplication prevents duplicate collection across runs  
- Configurable scroll count & output naming ✏️  

---

