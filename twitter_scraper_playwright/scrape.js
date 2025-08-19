// scrape.js
import { config as dotenvConfig } from 'dotenv';
import { chromium } from 'playwright'; // Import Chromium browser
import path from 'path';
import { security_question_sentiment } from './utils/button_sentiment.js';
import { Logger } from './utils/log.js';
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
    const browser = await chromium.launch({
        headless: false,
        proxy: {
            server: httpProxy,
            username: '', // Add if your proxy requires authentication
            password: '' // Add if your proxy requires authentication
        }
    }); // Launch browser (headless: false means visible)
    // Create context properly
    const context = await browser.newContext();
    // Now you can clear cookies
    await context.clearCookies();
    const page = await context.newPage(); // Use context.newPage(), not browser.newPage()
    const init = async () => {
        try {
            console.time('x.com load');
            await page.goto('https://x.com', { waitUntil: "networkidle" }); //
            console.timeEnd('x.com load');
            // Example: Capture a screenshot (just to see it works)
            await page.screenshot({ path: logger.root_folder + "/initial_screenshot.jpg" });
            // Example: Get page title
            const title = await page.title();
            console.log('Page Title:', title);
            await login(page);
            await page.waitForLoadState('networkidle');
            await close_default_popup(page);
        }
        catch (error) {
            console.error('Error during init phase:', error);
        }
        finally {
            console.time("after login redirect");
            await page.waitForLoadState("networkidle", { timeout: 10000 }); // the redirect to timeline after login
            console.timeEnd("after login redirect");
            let title = await page.title();
            let url = await page.url();
            console.log('Page Title:', title, " - page url : ", url);
            let dalay = new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve(1);
                }, 2000);
            });
            title = await page.title();
            url = await page.url();
            console.log('Page Title:', title, " - page url : ", url);
        }
    };
    await init();
    const get_tweets = async () => {
        try {
            console.log("get tweets init");
            let tweet_bulk = [];
            console.time("tweets load");
            await page.waitForLoadState('networkidle');
            console.timeEnd("tweets load");
            const tweets_full = page.locator('[role="article"][tabindex="0"][data-testid="tweet"]');
            const count = await tweets_full.count();
            console.log("count = ", count);
            for (let i = 0; i < count; i++) {
                const tweet = tweets_full.nth(i);
                const content = await tweet.textContent();
                console.log(`Tweet ${i + 1}:`, content);
                if (count >= 10) {
                    break;
                }
            }
        }
        catch (error) {
            console.log("get tweets failed", error);
        }
    };
    await get_tweets();
}
;
async function close_default_popup(page) {
    try {
        // Wait up to 5s for the popup to appear
        const popup = await page.waitForSelector('[data-testid="mask"]', { timeout: 5000 });
        try {
            const closeButton = await popup.waitForSelector('[aria-label="Close"][role="button"]', { timeout: 3000 });
            await closeButton.click();
            console.log('Popup closed.');
        }
        catch (error) {
            console.error('no close button found');
        }
    }
    catch (err) {
        console.log('no mask found', err.message);
    }
}
async function login(page) {
    try {
        console.log("Waiting for login button...");
        const login_btn = await page.waitForSelector('a[href="/login"][role="link"]', { timeout: 5000 });
        if (login_btn) {
            console.log("Login button found. Clicking...");
            await login_btn.click();
        }
        else {
            console.log("Login button not found.");
            return;
        }
        console.log("Waiting for sign-in modal...");
        const signin_modal = await page.waitForSelector('[aria-labelledby="modal-header"][aria-modal="true"][role="dialog"]', { timeout: 6000 });
        if (signin_modal) {
            console.log("Sign-in modal found.");
        }
        else {
            console.log("Sign-in modal not found.");
            return;
        }
        console.log("Waiting for username input...");
        const username = await page.waitForSelector('input[autocomplete="username"]');
        if (username) {
            console.log("Username input found. Typing...");
            await page.type('input[autocomplete="username"]', process.env.TWITTER_EMAIL);
        }
        else {
            console.log("Username input not found.");
            return;
        }
        console.log("clicking next...");
        const nextButton = await page.getByRole('button', { name: 'Next' });
        if (nextButton) {
            console.log("nextbutton input found. clicking");
            await nextButton.click();
        }
        else {
            console.log("nextbutton not found.");
            return;
        }
        await handle_password(page);
        await handle_confirm_phone(page);
    }
    catch (error) {
        console.error("error during login phase:", error);
    }
}
async function handle_password(page) {
    const pass_input = page.waitForSelector('input[autocomplete="current-password"]');
    const sus_input = page.waitForSelector('input[data-testid="ocfEnterTextTextInput"]');
    var is_sus = true;
    Promise.race([
        pass_input.then(async (pass_input) => {
            //do password
            is_sus = false;
            console.log("password input found. entering and submitting");
            await pass_input.type(process.env.TWITTER_PASSWORD);
            await page.keyboard.press('Enter');
            return;
        }),
        sus_input.then(async (sus_input) => {
            if (!is_sus) {
                return;
            }
            if (process.env.TWITTER_USERNAME) {
                await sus_input.type(process.env.TWITTER_USERNAME);
            }
            else if (process.env.TWITTER_PHONE) {
                await sus_input.type(process.env.TWITTER_PHONE);
            }
            else {
                throw new Error("no twitter username or phone , cant pass sus activity");
            }
            await page.keyboard.press("Enter");
        })
    ]).finally(() => {
        return;
    });
}
async function handle_confirm_phone(page) {
    let overlay = null;
    try {
        overlay = await page.waitForLoadState('[data-testid="sheetDialog"]', { timeout: 3000 });
    }
    catch (error) {
        console.log("there was no confirm phone popup after sign in");
        return;
    }
    try {
        let phone_text = await overlay.locator('text="Review your phone"', { timeout: 2000 });
        let buttons = overlay.locator('button[role="button"]');
        let buttonArray = [];
        const count = await buttons.count();
        for (let i = 0; i < count; i++) {
            const button = buttons.nth(i);
            const text = await button.textContent();
            // console.log(`Button ${i}: ${text}`);
            buttonArray.push({
                text: text,
                ref: button,
            });
        }
        let confirm_choice = security_question_sentiment(buttonArray);
        console.log(confirm_choice);
        let confirm_button = confirm_choice.ref;
        await confirm_button.click();
    }
    catch (error) {
        console.log("confirm phone text wasnt found");
        return;
    }
}
async function mask_exists(page) {
    const overlay = page.waitForLoadState('[data-testid="mask"]');
}
