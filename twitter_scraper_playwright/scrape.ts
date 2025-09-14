// scrape.js
import { config as dotenvConfig } from 'dotenv';
import { chromium } from 'playwright';
import path from 'path';
import { text } from 'stream/consumers';
import { ref } from 'process';
import { security_question_sentiment } from './utils/button_sentiment.js';
import { Logger } from './utils/log.js';
import { extractTweetInfo } from './tweets';
import fs from 'fs/promises';

dotenvConfig({ path: path.resolve('/root/programming/clarityFeed/.env') });

// Get proxy settings from environment variables
const httpProxy = process.env.WSL_PROXY_HTTP;
const httpsProxy = process.env.WSL_PROXY_HTTPS;
const socksProxy = process.env.WSL_PROXY_SOCKS;

console.log(httpProxy, httpsProxy, socksProxy);

if (!httpProxy || !httpsProxy || !socksProxy) {
    console.error('Proxy settings not found. Please run setup_proxy_wsl.sh first.');
    process.exit(1);
}

// Parse command line arguments for profile support
const profileName = process.env.PROFILE || null;

console.log(`Profile mode: ${profileName ? `Using profile "${profileName}"` : 'Using credential login'}`);

main();

async function main() {
    const logger = new Logger();
    let browser = null;
    let context = null;
    let page = null;
    let allTweets = [];
    
    try {
        const browserConfig = await getBrowserConfig(profileName);
        if (browserConfig.userDataDir) {
            // Already a BrowserContext
            context = await chromium.launchPersistentContext(
                browserConfig.userDataDir,
                browserConfig.baseConfig
            );
            browser = context.browser(); // optional, if you need a Browser reference
        } else {
            browser = await chromium.launch(browserConfig.baseConfig);
            context = await browser.newContext();
            await context.clearCookies();
        }
        
        page = await context.newPage();
        
        await init(page, logger, profileName);
        
        // Start collecting tweets with scroll functionality
        allTweets = await collectTweetsWithScroll(page, logger);
        
        console.log("Total unique tweets collected:", allTweets.length);
        
        // Output results to file
        await outputResults(allTweets, logger);
        
    } catch (error) {
        console.error('Error in main function:', error);
    } finally {
        // Clean up resources
        try {
            if (page) await page.close();
            if (context) await context.close(); // for both persistent & normal
            if (browser && !browser.isConnected?.()) await browser.close();
        } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
        }
    }
}

async function getBrowserConfig(profileName) {
  const baseConfig = {
        headless: false,
        proxy: {
            server: httpProxy,
            username: '',
            password: ''
        },
    };
  let return_type = {
    baseConfig:baseConfig,
    userDataDir:undefined
  }
    if (profileName) {
        // Profile-based configuration
        const profilesDir = path.resolve(process.env.ROOT_FS_ABS + '/profiles');
        const profilePath = path.join(profilesDir, profileName);
        
        try {
            // Ensure profiles directory exists
            await fs.mkdir(profilesDir, { recursive: true });
            
            console.log(`Using browser profile: ${profilePath}`);
            
            return_type.userDataDir = profilePath;
        } catch (error) {
            console.error('Error setting up profile directory:', error);
            throw error;
        }
    }
    return return_type;
}

async function collectTweetsWithScroll(page, logger, maxScrolls = 3) {
    const seenTweetIds = new Set();
    const allTweets = [];
    let scrollCount = 0;
    let noNewTweetsCount = 0;
    const maxNoNewTweets = 3; // Stop if no new tweets found after 3 scrolls
    
    console.log("Starting tweet collection with scroll...");
    
    while (scrollCount < maxScrolls && noNewTweetsCount < maxNoNewTweets) {
        console.log(`\n--- Scroll iteration ${scrollCount + 1} ---`);
        
        // Wait for tweets to load
        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch (error) {
            console.log('Warning: Page did not reach networkidle state:', error.message);
        }
        
        // Get currently visible tweets
        const newTweets = await getVisibleNewTweets(page, seenTweetIds,logger);
        
        if (newTweets.length === 0) {
            noNewTweetsCount++;
            console.log(`No new tweets found. Count: ${noNewTweetsCount}/${maxNoNewTweets}`);
        } else {
            noNewTweetsCount = 0; // Reset counter when new tweets are found
            allTweets.push(...newTweets);
            console.log(`Found ${newTweets.length} new tweets. Total: ${allTweets.length}`);
        }
        
        // Scroll down to load more tweets
        await scrollToLoadMore(page);
        scrollCount++;
        
        // Wait a bit for new content to load
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\nFinished collecting tweets. Total scrolls: ${scrollCount}`);
    return allTweets;
}

async function getVisibleNewTweets(page, seenTweetIds,logger) {
    const newTweets = [];
    
    try {
        // Get all tweet elements currently in the DOM
        const tweets_full = page.locator('[role="article"][tabindex="0"][data-testid="tweet"]');
        const count = await tweets_full.count();
        console.log(`Found ${count} tweet elements in DOM`);
        
        for (let i = 0; i < count; i++) {
            try {
                const tweet = tweets_full.nth(i);
                
                // Check if tweet is visible in viewport
                const isVisible = await tweet.isVisible();
                if (!isVisible) continue;
                
                // Get a unique identifier for this tweet (you might need to adjust this based on your extractTweetInfo function)
                const tweetHandle = await tweet.elementHandle();
                const documentHandle = await page.evaluateHandle(() => document);
                
                // Extract tweet info
                // const tweetParsed = await extractTweetInfo(tweetHandle, documentHandle);
                const tweetParsedObj = await extractTweetInfoPlaywright(tweetHandle);
                const tweetParsed = tweetParsedObj.tweetData;
                const tweetLogs = tweetParsedObj.logs;
                tweetLogs.forEach(log=>logger.log(log));
                // Create a unique ID for the tweet (adjust based on your tweet structure)
                const tweetId = generateTweetId(tweetParsed);
                
                // Skip if we've already seen this tweet
                if (seenTweetIds.has(tweetId)) {
                    continue;
                }
                
                // Add to seen tweets and new tweets array
                seenTweetIds.add(tweetId);
                newTweets.push({
                    ...tweetParsed,
                    _uniqueId: tweetId,
                    _collectedAt: new Date().toISOString()
                });
                
                console.log(`New tweet collected: ${tweetId}`);
                
            } catch (error) {
                console.error(`Error processing tweet ${i + 1}:`, error.message);
            }
        }
        
    } catch (error) {
        console.error("Error getting visible tweets:", error);
    }
    
    return newTweets;
}

function generateTweetId(tweetData) {
    // Generate a unique ID based on tweet content
    // Adjust this based on your tweet data structure
    if (tweetData.id) {
        return tweetData.id;
    }
    
    // Fallback: create ID from content hash or combination of fields
    const contentString = JSON.stringify({
        text: tweetData.text || tweetData.content,
        author: tweetData.author || tweetData.username,
        timestamp: tweetData.timestamp || tweetData.time
    });
    
    // Simple hash function (you might want to use a proper hash library)
    let hash = 0;
    for (let i = 0; i < contentString.length; i++) {
        const char = contentString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `tweet_${Math.abs(hash)}`;
}

async function scrollToLoadMore(page) {
    try {
        // Scroll to bottom of page to trigger loading more tweets
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        
        // Alternative: Scroll by viewport height
        // await page.evaluate(() => {
        //     window.scrollBy(0, window.innerHeight);
        // });
        
        console.log("Scrolled to load more content");
    } catch (error) {
        console.error("Error scrolling:", error);
    }
}

async function outputResults(tweets, logger) {
    try {
        const outputData = {
            collectionInfo: {
                totalTweets: tweets.length,
                collectedAt: new Date().toISOString(),
                source: 'twitter_scraper',
                profile: profileName || 'credential_login'
            },
            tweets: tweets
        };
        
        // Output to JSON file
        const profileSuffix = profileName ? `_${profileName}` : '';
        const outputPath = path.join(logger.root_folder, `tweets${profileSuffix}_${Date.now()}.json`);
        await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
        console.log(`Results saved to: ${outputPath}`);
        
        // Also output summary to console
        console.log("\n=== COLLECTION SUMMARY ===");
        console.log(`Total tweets collected: ${tweets.length}`);
        console.log(`Profile used: ${profileName || 'credential_login'}`);
        console.log(`Collection completed at: ${new Date().toISOString()}`);
        
        if (tweets.length > 0) {
            console.log("\n=== SAMPLE TWEETS ===");
            tweets.slice(0, 3).forEach((tweet, index) => {
                console.log(`\nTweet ${index + 1}:`);
                console.log(`ID: ${tweet._uniqueId}`);
                console.log(`Content: ${JSON.stringify(tweet, null, 2).substring(0, 200)}...`);
            });
        }
        
    } catch (error) {
        console.error("Error outputting results:", error);
    }
}

async function extractTweetInfoPlaywright(tweetLocator) {
    return await tweetLocator.evaluate((tweetEl, loggerEnabled) => {
        const tweetData = {
            author: '',
            content: '',
            retweetInfo: {},
            media: [],
            timestamp: null,
            id: null
        };
        let logData=[];
        function logMessage(message) {
          logData.push(message);
            if (loggerEnabled) {
                console.log(message);
            }
        }

        function extractRetweetInfo(tweetEl) {
            try {
                const retweetInfo = {
                    is_retweet: false,
                    retweet_author: null,
                    original_tweet: null,
                    retweet_content: null,
                    is_quote_tweet: false,
                    quoted_content: null,
                    quoted_author: null
                };

                // Method 1: Check for social context - this is the most reliable indicator
                const socialContextEl = tweetEl.querySelector("span[data-testid='socialContext']");
                if (socialContextEl) {
                    const contextText = socialContextEl.textContent?.trim();
                    logMessage(`Found social context: ${contextText}`);
                    
                    if (contextText && (contextText.includes('Retweeted') || contextText.includes('retweeted'))) {
                        retweetInfo.is_retweet = true;
                        
                        // Extract who retweeted it - look for pattern "Username Retweeted"
                        const retweetMatch = contextText.match(/^(.+?)\s+(?:Retweeted|retweeted)/);
                        if (retweetMatch) {
                            retweetInfo.retweet_author = retweetMatch[1].trim();
                        }
                        
                        logMessage(`Detected retweet by: ${retweetInfo.retweet_author}`);
                        
                        // Get the original tweet content
                        const tweetTextEl = tweetEl.querySelector('[data-testid="tweetText"]');
                        if (tweetTextEl) {
                            retweetInfo.retweet_content = tweetTextEl.textContent?.trim();
                        }
                        
                        return retweetInfo;
                    }
                }

                // Method 2: Check for retweet icon in the tweet structure (not the action buttons)
                // Look for retweet icon that appears above the tweet content
                const retweetIconSelectors = [
                    'svg[viewBox="0 0 24 24"] path[d*="4.5 3.88"]', // Retweet icon path
                    'svg[viewBox="0 0 24 24"] path[d*="16.5 6H11V4h5.5"]', // Alternative retweet path
                ];
                
                for (const selector of retweetIconSelectors) {
                    const retweetIcon = tweetEl.querySelector(selector);
                    if (retweetIcon) {
                        // Make sure this icon is not in the action buttons area
                        const actionArea = retweetIcon.closest('[role="group"]');
                        if (!actionArea) {
                            retweetInfo.is_retweet = true;
                            logMessage('Detected retweet via icon structure');
                            
                            // Get content
                            const tweetTextEl = tweetEl.querySelector('[data-testid="tweetText"]');
                            if (tweetTextEl) {
                                retweetInfo.retweet_content = tweetTextEl.textContent?.trim();
                            }
                            
                            return retweetInfo;
                        }
                    }
                }

                // Method 3: Check for quote tweet structure
                const quoteElements = tweetEl.querySelectorAll('div[role="link"][tabindex="0"]');
                for (const quoteEl of quoteElements) {
                    // Skip if this is just a regular link
                    if (quoteEl.querySelector('a[href^="http"]')) continue;
                    
                    const quotedContent = quoteEl.querySelector('[data-testid="tweetText"]');
                    if (quotedContent) {
                        retweetInfo.is_quote_tweet = true;
                        retweetInfo.quoted_content = quotedContent.textContent?.trim();
                        
                        // Extract quoted tweet author info
                        const quotedAuthorElements = quoteEl.querySelectorAll('[data-testid="User-Name"] span');
                        for (const authorEl of quotedAuthorElements) {
                            const authorText = authorEl.textContent?.trim();
                            if (authorText && !authorText.includes('@') && authorText.length > 0) {
                                retweetInfo.quoted_author = authorText;
                                break;
                            }
                        }
                        
                        logMessage(`Detected quote tweet. Author: ${retweetInfo.quoted_author}`);
                        break;
                    }
                }

                // Method 4: Look for "Show this thread" or similar retweet indicators
                const threadIndicators = tweetEl.querySelectorAll('span');
                for (const span of threadIndicators) {
                    const text = span.textContent?.trim().toLowerCase();
                    if (text && (text.includes('retweeted') || text.includes('retweet'))) {
                        // Make sure it's not in the action buttons
                        const actionGroup = span.closest('[role="group"]');
                        if (!actionGroup) {
                            retweetInfo.is_retweet = true;
                            logMessage(`Detected retweet via text indicator: ${text}`);
                            
                            const tweetTextEl = tweetEl.querySelector('[data-testid="tweetText"]');
                            if (tweetTextEl) {
                                retweetInfo.retweet_content = tweetTextEl.textContent?.trim();
                            }
                            break;
                        }
                    }
                }

                return retweetInfo;
                
            } catch (error) {
                logMessage("Error in retweetInfo detection: " + error.message);
                return {
                    is_retweet: false,
                    retweet_author: null,
                    original_tweet: null,
                    retweet_content: null,
                    is_quote_tweet: false,
                    quoted_content: null,
                    quoted_author: null
                };
            }
        }

        try {
            // Author - look for the username/handle
            const authorEl = tweetEl.querySelector("div[dir='ltr'] span");
            if (authorEl) {
                tweetData.author = authorEl.textContent?.trim() || '';
            }
            
            // Fallback: try different selectors for author
            if (!tweetData.author) {
                const authorElements = tweetEl.querySelectorAll('[data-testid="User-Name"] span');
                for (const el of authorElements) {
                    const text = el.textContent?.trim();
                    if (text && !text.includes('@') && text.length > 0) {
                        tweetData.author = text;
                        break;
                    }
                }
            }

            // Tweet content
            const contentEl = tweetEl.querySelector("div[data-testid='tweetText']");
            if (contentEl) {
                tweetData.content = contentEl.textContent?.trim() || '';
            }

            // Extract retweet info
            const retweetInfo = extractRetweetInfo(tweetEl);
            tweetData.retweetInfo = retweetInfo;
            
            // Log the detection result
            if (retweetInfo.is_retweet) {
                logMessage(`✓ RETWEET DETECTED - Author: ${retweetInfo.retweet_author}, Content: ${retweetInfo.retweet_content?.substring(0, 50)}...`);
            } else if (retweetInfo.is_quote_tweet) {
                logMessage(`✓ QUOTE TWEET DETECTED - Quoted Author: ${retweetInfo.quoted_author}`);
            } else {
                logMessage(`○ Regular tweet - Author: ${tweetData.author}`);
            }

            // Media links (images + videos)
            const mediaLinks = [];
            
            // Images
            const images = tweetEl.querySelectorAll("img[src*='pbs.twimg.com/media']");
            images.forEach(img => {
                const src = img.getAttribute('src');
                if (src) mediaLinks.push(src);
            });

            // Videos
            const videos = tweetEl.querySelectorAll("video source");
            videos.forEach(vid => {
                const src = vid.getAttribute('src');
                if (src) mediaLinks.push(src);
            });

            // Video thumbnails
            const videoThumbs = tweetEl.querySelectorAll("img[src*='video_thumb']");
            videoThumbs.forEach(thumb => {
                const src = thumb.getAttribute('src');
                if (src) mediaLinks.push(src);
            });

            tweetData.media = mediaLinks;

            // Timestamp
            tweetData.timestamp = null;
            const timeEl = tweetEl.querySelector('time');
            if (timeEl) {
                tweetData.timestamp = timeEl.getAttribute('datetime') || timeEl.textContent?.trim();
            }

            // Tweet ID from URL
            tweetData.id = null;
            const linkEl = tweetEl.querySelector('a[href*="/status/"]');
            if (linkEl) {
                const href = linkEl.getAttribute('href');
                const match = href?.match(/\/status\/(\d+)/);
                if (match) {
                    tweetData.id = match[1];
                }
            }

        } catch (error) {
            logMessage('Error extracting tweet data: ' + error.message);
        }

        return {
          "tweetData":tweetData,
          "logs":logData
        };
    },true); // Pass a boolean flag for logging
}

// Updated init function to handle both profile and credential login
const init = async(page, logger, profileName) => {
    try {
        console.time('x.com load');
        await page.goto('https://x.com', { waitUntil: "networkidle" });
        console.timeEnd('x.com load');
        
        await page.screenshot({ path: logger.root_folder + "/initial_screenshot.jpg" });
        
        const title = await page.title();
        console.log('Page Title:', title);
        
        // Check if already logged in (for profile mode)
        const isLoggedIn = await checkIfLoggedIn(page);
        
        if (profileName && isLoggedIn) {
            console.log('Already logged in with profile, skipping login process');
        } else {
            console.log('Proceeding with login...');
            await login(page);
            
            try {
                await page.waitForLoadState('networkidle', { timeout: 10000 });
            } catch (error) {
                console.log('Warning: Page did not reach networkidle state after login:', error.message);
            }
        }
        
        await close_default_popup(page);
    } catch (error) {
        console.error('Error during init phase:', error);
    }
    
    try {
        console.time("after login redirect");
        await page.waitForLoadState("networkidle", { timeout: 10000 });
        console.timeEnd("after login redirect");
        let title = await page.title();
        let url = await page.url();
        console.log('Page Title:', title, " - page url : ", url);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        title = await page.title();
        url = await page.url();
        console.log('Page Title:', title, " - page url : ", url);
    } catch (error) {
        console.error('Error during post-login phase:', error);
    }
}

async function checkIfLoggedIn(page) {
    try {
        // Wait a bit for the page to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check for elements that indicate we're logged in
        const loggedInIndicators = [
            '[data-testid="SideNav_AccountSwitcher_Button"]', // Profile button
            '[data-testid="primaryColumn"]', // Main timeline column
            // 'nav[role="navigation"]', // Navigation bar - ❌ appears for both states
            '[data-testid="AppTabBar_Home_Link"]', // Home tab
        ];
        
        for (const selector of loggedInIndicators) {
            try {
                const element = await page.waitForSelector(selector, { timeout: 3000 });
                if (element) {
                    console.log(`Found logged-in indicator: ${selector}`);
                    return true;
                }
            } catch (error) {
                // Continue checking other indicators
                continue;
            }
        }
        
        // Check if we see login button (indicates not logged in)
        try {
            const loginButton = await page.waitForSelector('a[href="/login"]', { timeout: 2000 });
            if (loginButton) {
                console.log('Found login button - not logged in');
                return false;
            }
        } catch (error) {
            // Login button not found, might be logged in
        }
        
        // Additional check: look at URL
        const url = page.url();
        if (url.includes('/home') || url.includes('/i/flow/login') === false) {
            console.log('URL suggests logged in state');
            return true;
        }
        
        console.log('Could not determine login state, assuming not logged in');
        return false;
        
    } catch (error) {
        console.error('Error checking login state:', error);
        return false;
    }
}

async function close_default_popup(page) {
    try {
        const popup = await page.waitForSelector('[data-testid="mask"]', { timeout: 5000 });
        try {
            const closeButton = await popup.waitForSelector('[aria-label="Close"][role="button"]', { timeout: 3000 });
            await closeButton.click();
            console.log('Popup closed.');
        } catch (error) {
            console.error('no close button found:', error.message);
        }
    } catch (err) {
        console.log('no mask found:', err.message);
    }
}

async function login(page) {
    try {
        console.log("Waiting for login button...");
        const login_btn = await page.waitForSelector('a[href="/login"][role="link"]', { timeout: 5000 });
        if (login_btn) {
            console.log("Login button found. Clicking...");
            await login_btn.click();
        } else {
            console.log("Login button not found.");
            return;
        }

        console.log("Waiting for sign-in modal...");
        const signin_modal = await page.waitForSelector('[aria-labelledby="modal-header"][aria-modal="true"][role="dialog"]', { timeout: 6000 });
        if (signin_modal) {
            console.log("Sign-in modal found.");
        } else {
            console.log("Sign-in modal not found.");
            return;
        }

        console.log("Waiting for username input...");
        const username = await page.waitForSelector('input[autocomplete="username"]');
        if (username) {
            console.log("Username input found. Typing...");
            await page.type('input[autocomplete="username"]', process.env.TWITTER_EMAIL);
        } else {
            console.log("Username input not found.");
            return;
        }

        console.log("clicking next...");
        const nextButton = await page.getByRole('button', { name: 'Next' });
        if (nextButton) {
            console.log("nextbutton input found. clicking");
            await nextButton.click();
        } else {
            console.log("nextbutton not found.");
            return;
        }
        await handle_password(page);
        await handle_confirm_phone(page);
    } catch (error) {
        console.error("error during login phase:", error);
    }
}

async function handle_password(page) {
    try {
        const pass_input = page.waitForSelector('input[autocomplete="current-password"]');
        const sus_input = page.waitForSelector('input[data-testid="ocfEnterTextTextInput"]');
        
        let is_sus = true;
        
        await Promise.race([
            pass_input.then(async(pass_input) => {
                is_sus = false;
                console.log("password input found. entering and submitting");
                await pass_input.type(process.env.TWITTER_PASSWORD);
                await page.keyboard.press('Enter');
                return;
            }),
            sus_input.then(async(sus_input) => {
                if (!is_sus) {
                    return;
                }
                if (process.env.TWITTER_USERNAME) {
                    await sus_input.type(process.env.TWITTER_USERNAME)
                } else if (process.env.TWITTER_PHONE) {
                    await sus_input.type(process.env.TWITTER_PHONE)
                } else {
                    throw new Error("no twitter username or phone , cant pass sus activity")
                }
                await page.keyboard.press("Enter");
            })
        ]);
    } catch (error) {
        console.error("Error in handle_password:", error);
    }
}

async function handle_confirm_phone(page) {
    try {
        const overlay = await page.waitForSelector('[data-testid="sheetDialog"]', { timeout: 3000 });
        
        try {
            const phone_text = await overlay.waitForSelector('text="Review your phone"', { timeout: 2000 });
            
            const buttons = overlay.locator('button[role="button"]');
            let buttonArray = [];
            const count = await buttons.count();
            for (let i = 0; i < count; i++) {
                const button = buttons.nth(i);
                const text = await button.textContent();
                
                buttonArray.push({
                    text: text,
                    ref: button,
                });
            }

            let confirm_choice = security_question_sentiment(buttonArray);
            console.log(confirm_choice);
            let confirm_button = confirm_choice.ref;
            await confirm_button.click()
            
        } catch (error) {
            console.log("confirm phone text wasnt found:", error.message);
        }
    } catch (error) {
        console.log("there was no confirm phone popup after sign in:", error.message);
    }
}

async function mask_exists(page) {
    try {
        const overlay = await page.waitForSelector('[data-testid="mask"]', { timeout: 5000 });
        return !!overlay;
    } catch (error) {
        return false;
    }
}