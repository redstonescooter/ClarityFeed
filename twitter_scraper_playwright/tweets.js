import fs from "fs";
import * as cheerio from "cheerio";
/**
 * Extracts author, text, retweet info, and media from a tweet HTML element.
 */
export function extractTweetInfo(tweetEl, $) {
    const tweetData = {};
    // Author
    const authorEl = $(tweetEl).find("div[dir='ltr'] span").first();
    tweetData.author = authorEl.text().trim() || null;
    // Tweet content
    const contentEl = $(tweetEl).find("div[data-testid='tweetText']");
    tweetData.content = contentEl.text().trim() || null;
    // Retweet info
    const retweetEl = $(tweetEl).find("span:contains('Retweeted')");
    tweetData.is_retweet = retweetEl.length > 0;
    tweetData.retweet_content = tweetData.is_retweet
        ? contentEl.text().trim()
        : null;
    // Media links (images + videos)
    const mediaLinks = [];
    $(tweetEl)
        .find("img[src*='pbs.twimg.com/media']")
        .each((_, img) => mediaLinks.push($(img).attr("src")));
    $(tweetEl)
        .find("video source")
        .each((_, vid) => mediaLinks.push($(vid).attr("src")));
    tweetData.media = mediaLinks;
    return tweetData;
}
/**
 * Parses a saved Twitter timeline HTML file and extracts tweets.
 */
function parseTimeline(htmlPath) {
    const html = fs.readFileSync(htmlPath, "utf-8");
    const $ = cheerio.load(html);
    const tweets = [];
    $("article[data-testid='tweet']").each((_, tweet) => {
        tweets.push(extractTweetInfo(tweet, $));
    });
    return tweets;
}
// Example usage
const tweets = parseTimeline("twitter_timeline_1_full.html");
console.log(tweets);
