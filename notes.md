### Step 2: Create a Virtual Environment
python3 -m venv myenv
### Step 3: Activate the Virtual Environment
source myenv/bin/activate

### start chrome from wsl terminal :
google-chrome --no-sandbox
### google chrome with proxy :
google-chrome --no-sandbox --proxy-server="http=172.27.192.1:10811;https=172.27.192.1:10811"


Host system is missing dependencies to run browsers. ║
║ Missing libraries:                                   ║
║     libgtk-4.so.1                                    ║
║     libgraphene-1.0.so.0                             ║
║     libwoff2dec.so.1.0.2                             ║
║     libvpx.so.9                                      ║
║     libevent-2.1.so.7                                ║
║     libopus.so.0                                     ║
║     libgstallocators-1.0.so.0                        ║
║     libgstapp-1.0.so.0                               ║
║     libgstpbutils-1.0.so.0                           ║
║     libgstaudio-1.0.so.0                             ║
║     libgstgl-1.0.so.0                                ║
║     libgsttag-1.0.so.0                               ║
║     libgstvideo-1.0.so.0                             ║
║     libgstcodecparsers-1.0.so.0                      ║
║     libgstfft-1.0.so.0                               ║
║     libflite.so.1                                    ║
║     libflite_usenglish.so.1                          ║
║     libflite_cmu_grapheme_lang.so.1                  ║
║     libflite_cmu_grapheme_lex.so.1                   ║
║     libflite_cmu_indic_lang.so.1                     ║
║     libflite_cmu_indic_lex.so.1                      ║
║     libflite_cmulex.so.1                             ║
║     libflite_cmu_time_awb.so.1                       ║
║     libflite_cmu_us_awb.so.1                         ║
║     libflite_cmu_us_kal16.so.1                       ║
║     libflite_cmu_us_kal.so.1                         ║
║     libflite_cmu_us_rms.so.1                         ║
║     libflite_cmu_us_slt.so.1                         ║
║     libwebpdemux.so.2                                ║
║     libavif.so.16                                    ║
║     libharfbuzz-icu.so.0                             ║
║     libwebpmux.so.3                                  ║
║     libenchant-2.so.2                                ║
║     libsecret-1.so.0                                 ║
║     libhyphen.so.0                                   ║
║     libmanette-0.2.so.0                              ║
║     libx264.so 

installed .

### to start the scrapy project
scrapy startproject twitter_scraper

res :
```
(myenv) root@zddra:~/programming/clarityFeed# scrapy startproject twitter_scraper
New Scrapy project 'twitter_scraper', using template directory '/root/programming/clarityFeed/myenv/lib/python3.12/site-packages/scrapy/templates/project', created in:
    /root/programming/clarityFeed/twitter_scraper

You can start your first spider with:
    cd twitter_scraper
    scrapy genspider example example.com
```


### initlialize project :
first manually run : chmod +x ./initialize_project.sh
then run : ./initialize_project.sh