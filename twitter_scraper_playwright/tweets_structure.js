root : aria-label="Timeline: Your Home Timeline"

-0 // the entire tweet
role="article"
tabindex="0"
data-testid="tweet"

-0-0
data-testid="User-Name"

-0-0-0
<a href="/ImSh4yy" role="link" //link to user profile

-0-0-0-0
data-testid="icon-verified" // optional

-0-1
data-testid="tweetText" //text

-0-2
<a href="/ImSh4yy/status/1929259547383762979/photo/1" role="link"

0-2-0
<div aria-label="Image" data-testid="tweetPhoto"

0-2-0-0 // the actual image
<img alt="Image" draggable="true" src="https://pbs.twimg.com/media/GsYbVXQWAAA0U4O?format=jpg&amp;name=small"


0-2-0-1
data-testid="videoComponent" // does not have 0-2 as parent but has 0-2-0





0-3
aria-label="Share post" // share post

after clicked ==> in page root :

role="menu"
    role="menuitem"
        innerText = "Copy link"



retweets : 
could have all the components of a normal tweet. from 0-0 all the way to 0-5 ( it either has condensedMedia or an image or video (if the original tweet had any) , i dont think it can have both condensed media and video/image)

0-4
data-testid="testCondensedMedia" //rewteet that is condensed

0-5

data-testid="Tweet-User-Avatar" //tweet owner avatar