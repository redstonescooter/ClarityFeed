
export function extractTweetInfo(tweetEl, $) {
  const tweetData = {} as{
    author:string,
    content:string,
    is_retweet:boolean,
    retweet_count:boolean|null,
    retweet_content:string|null,
    media:string[]
  };

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


 