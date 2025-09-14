// functions/tweets.js

export async function getTweets(page,logger, resume = false) {
  try {
    console.log("Getting tweets...");
    
    let tweet_bulk = [];
    console.time("tweets load");
    
    // Check if we're on the right page
    const currentUrl = await page.url();
    if (!currentUrl.includes('/home') && !currentUrl.includes('/timeline') && !currentUrl.includes('x.com')) {
      console.log('Not on Twitter timeline. Navigating to home...');
      await page.goto('https://x.com/home', { waitUntil: "networkidle" });
    }
    
    try {
      await page.waitForLoadState('networkidle');
    } catch (error) {
      console.log('Warning: Page did not reach networkidle state:', error.message);
    }
    
    console.timeEnd("tweets load");
    
    // Wait for tweets to load
    await page.waitForSelector('[role="article"][tabindex="0"][data-testid="tweet"]', { timeout: 10000 });
    
    const tweets_full = page.locator('[role="article"][tabindex="0"][data-testid="tweet"]');
    const count = await tweets_full.count();
    console.log("Tweet count found:", count);
    
    if (count === 0) {
      console.log("No tweets found on the page.");
      return [];
    }
    
    for (let i = 0; i < count; i++) {
      try {
        const tweet = tweets_full.nth(i);
        const content = await tweet.textContent();
        
        // Extract additional tweet metadata if available
        const tweetData = {
          index: i + 1,
          content: content.trim(),
          timestamp: new Date().toISOString()
        };
        
        tweet_bulk.push(tweetData);
        console.log(`Tweet ${i + 1}:`, content.substring(0, 100) + (content.length > 100 ? '...' : ''));
        
        if (i >= 9) { // Stop after 10 tweets
          break;
        }
      } catch (error) {
        console.error(`Error processing tweet ${i + 1}:`, error.message);
      }
    }
    
    console.log(`\nSuccessfully processed ${tweet_bulk.length} tweets.`);
    return tweet_bulk;
    
  } catch (error) {
    console.error("Get tweets failed:", error);
    throw error;
  }
}