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

main();

async function main() {
    const logger = new Logger();
    let browser = null;
    let context = null;
    let page = null;
    let allTweets = [];
    
    try {
        browser = await chromium.launch({
            headless: false,
            proxy: {
                server: httpProxy,
                username: '',
                password: ''
            }
        });
        
        context = await browser.newContext();
        await context.clearCookies();
        page = await context.newPage();
        
        await init(page, logger);
        
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
            if (context) await context.close();
            if (browser) await browser.close();
        } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
        }
    }
}

async function collectTweetsWithScroll(page, logger, maxScrolls = 10) {
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
                const tweetParsed = await extractTweetInfoPlaywright(tweetHandle,logger);
                
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
                source: 'twitter_scraper'
            },
            tweets: tweets
        };
        
        // Output to JSON file
        const outputPath = path.join(logger.root_folder, `tweets_${Date.now()}.json`);
        await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
        console.log(`Results saved to: ${outputPath}`);
        
        // Also output summary to console
        console.log("\n=== COLLECTION SUMMARY ===");
        console.log(`Total tweets collected: ${tweets.length}`);
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

async function extractTweetInfoPlaywright(tweetLocator,logger) {
    // Use Playwright's evaluate to extract tweet data directly from the DOM
    function retweetInfo(tweetEl) {
      try {
        const retweetInfo = {
          is_retweet: false,
          retweet_author: null,
          original_tweet: null,
          retweet_content: null,
          is_quote_tweet:false,
          quoted_content:null,
          quoted_author:null
        };

        // Method 1: Check for social context (most reliable)
        const socialContextEl = tweetEl.querySelector("span[data-testid='socialContext']");
        if (socialContextEl) {
            const contextText = socialContextEl.textContent?.trim();
            if (contextText && contextText.includes('Retweeted')) {
                retweetInfo.is_retweet = true;
                // Extract who retweeted it
                const retweetMatch = contextText.match(/(.+)\s+Retweeted/);
                if (retweetMatch) {
                    retweetInfo.retweet_author = retweetMatch[1].trim();
                }
            }
        }

        // Method 2: Check for retweet icon in header (alternative detection)
        if (!retweetInfo.is_retweet) {
            const retweetHeaderEl = tweetEl.querySelector('[aria-label*="Retweet"]');
            if (retweetHeaderEl && retweetHeaderEl.closest('[data-testid="tweet"]') === tweetEl) {
                retweetInfo.is_retweet = true;
            }
        }

        // Method 3: Check for quote tweet structure
        if (!retweetInfo.is_retweet) {
            const quoteEl = tweetEl.querySelector('div[role="link"][tabindex="0"]');
            if (quoteEl) {
                // This is a quote tweet, which is different from a retweet
                const quotedContent = quoteEl.querySelector('[data-testid="tweetText"]');
                if (quotedContent) {
                    retweetInfo.is_quote_tweet = true;
                    retweetInfo.quoted_content = quotedContent.textContent?.trim();
                    
                    // Extract quoted tweet author info
                    const quotedAuthor = quoteEl.querySelector('[data-testid="User-Name"]');
                    if (quotedAuthor) {
                        retweetInfo.quoted_author = quotedAuthor.textContent?.trim();
                    }
                }
            }
        }

        // Method 4: Check tweet structure for retweet indicators
        // if (!retweetInfo.is_retweet) {
        //     // Look for retweet indicator in the tweet header area
        //     const tweetHeader = tweetEl.querySelector('[data-testid="User-Name"]')?.closest('div');
        //     if (tweetHeader) {
        //         const retweetIndicator = tweetHeader.querySelector('svg[viewBox="0 0 24 24"]');
        //         if (retweetIndicator) {
        //             const pathEl = retweetIndicator.querySelector('path[d*="4.5 3.88"]'); // Retweet icon path
        //             if (pathEl) {
        //                 retweetInfo.is_retweet = true;
        //             }
        //         }
        //     }
        // }

        // Only set retweet_content if it's actually a retweet
        if (retweetInfo.is_retweet) {
            // For pure retweets, the content is the original tweet content
            const tweetTextEl = tweetEl.querySelector('[data-testid="tweetText"]');
            if (tweetTextEl) {
                retweetInfo.retweet_content = tweetTextEl.textContent?.trim();
            }
        }

        // Don't confuse interaction buttons with retweet status
        // The retweet button in the action bar is for user interaction, not tweet classification
        logger.log("Retweet info extracted: " + JSON.stringify(retweetInfo));
        return retweetInfo;
      } catch (error) {
        logger.log("error in retweetInfo detection: " + error.message);
      }
    }
    return await tweetLocator.evaluate((tweetEl) => {
        const tweetData = {
            author: '',
            content: '',
            retweetInfo:{},
            media: [],
            timestamp: null,
            id: null
            
        };

        try {
            // Author - look for the username/handle
            const authorEl = tweetEl.querySelector("div[dir='ltr'] span");
            if (authorEl) {
                tweetData.author = authorEl.textContent?.trim() || '';
            }
            
            // Fallback: try different selectors for author
            if (!tweetData.author) {
                const authorAltEl = tweetEl.querySelector('[data-testid="User-Name"] span');
                if (authorAltEl) {
                    tweetData.author = authorAltEl.textContent?.trim() || '';
                }
            }

            // Tweet content
            const contentEl = tweetEl.querySelector("div[data-testid='tweetText']");
            if (contentEl) {
                tweetData.content = contentEl.textContent?.trim() || '';
            }

            // Retweet info
            tweetData.retweetInfo = retweetInfo(tweetEl);
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

            // Video thumbnails (sometimes videos show as images initially)
            const videoThumbs = tweetEl.querySelectorAll("img[src*='video_thumb']");
            videoThumbs.forEach(thumb => {
                const src = thumb.getAttribute('src');
                if (src) mediaLinks.push(src);
            });

            tweetData.media = mediaLinks;

            // Additional metadata
            tweetData.timestamp = null;
            const timeEl = tweetEl.querySelector('time');
            if (timeEl) {
                tweetData.timestamp = timeEl.getAttribute('datetime') || timeEl.textContent?.trim();
            }

            // Tweet ID from URL if available
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
            console.error('Error extracting tweet data:', error);
        }

        return tweetData;
    });
}

// Keep all the existing functions (init, login, etc.) unchanged
const init = async(page, logger) => {
    try {
        console.time('x.com load');
        await page.goto('https://x.com', { waitUntil: "networkidle" });
        console.timeEnd('x.com load');
        
        await page.screenshot({ path: logger.root_folder + "/initial_screenshot.jpg" });
        
        const title = await page.title();
        console.log('Page Title:', title);
        
        await login(page);
        
        try {
            await page.waitForLoadState('networkidle', { timeout: 10000 });
        } catch (error) {
            console.log('Warning: Page did not reach networkidle state after login:', error.message);
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