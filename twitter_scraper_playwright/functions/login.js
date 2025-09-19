// functions/login.js
import { security_question_sentiment } from '../../utils/button_sentiment.js';

export async function loginToTwitter(page,logger, resume = false) {
  try {
    // If resuming, check if we're already logged in
    if (resume) {
      const currentUrl = await page.url();
      if (currentUrl.includes('/home') || currentUrl.includes('/timeline')) {
        console.log('Already logged in, skipping login process...');
        return;
      }
    }
        
    console.log('Navigating to X.com...');
    console.time('x.com load');
    await page.goto('https://x.com', { waitUntil: "networkidle" });
    console.timeEnd('x.com load');

    // Take initial screenshot
    await page.screenshot({ path: logger.root_folder + "/initial_screenshot.jpg" });

    // Get page title
    const title = await page.title();
    console.log('Page Title:', title);

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

    console.log("Clicking next...");
    const nextButton = await page.getByRole('button', { name: 'Next' });
    if (nextButton) {
      console.log("Next button found. Clicking...");
      await nextButton.click();
    } else {
      console.log("Next button not found.");
      return;
    }

    await handlePassword(page);
    await handleConfirmPhone(page);
    await closeDefaultPopup(page);

    // Wait for redirect to timeline after login
    try {
      console.time("after login redirect");
      await page.waitForLoadState("networkidle", { timeout: 10000 });
      console.timeEnd("after login redirect");
      
      const title = await page.title();
      const url = await page.url();
      console.log('Post-login Page Title:', title, " - URL:", url);
      
      // Wait 2 seconds for any remaining redirects
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalTitle = await page.title();
      const finalUrl = await page.url();
      console.log('Final Page Title:', finalTitle, " - URL:", finalUrl);
      
    } catch (error) {
      console.error('Error during post-login phase:', error);
    }

  } catch (error) {
    console.error("Error during login phase:", error);
    throw error;
  }
}

async function handlePassword(page) {
  try {
    const pass_input = page.waitForSelector('input[autocomplete="current-password"]');
    const sus_input = page.waitForSelector('input[data-testid="ocfEnterTextTextInput"]');
    
    let is_sus = true;
    
    await Promise.race([
      pass_input.then(async(pass_input) => {
        // Handle password input
        is_sus = false;
        console.log("Password input found. Entering and submitting...");
        await pass_input.type(process.env.TWITTER_PASSWORD);
        await page.keyboard.press('Enter');
        return;
      }),
      sus_input.then(async(sus_input) => {
        if (!is_sus) {
          return;
        }
        // Handle suspicious activity check
        console.log("Suspicious activity check detected...");
        if (process.env.TWITTER_USERNAME) {
          await sus_input.type(process.env.TWITTER_USERNAME);
        } else if (process.env.TWITTER_PHONE) {
          await sus_input.type(process.env.TWITTER_PHONE);
        } else {
          throw new Error("No twitter username or phone, can't pass suspicious activity check");
        }
        await page.keyboard.press("Enter");
      })
    ]);
  } catch (error) {
    console.error("Error in handlePassword:", error);
    throw error;
  }
}

async function handleConfirmPhone(page) {
  try {
    console.log("Checking for phone confirmation popup...");
    const overlay = await page.waitForSelector('[data-testid="sheetDialog"]', { timeout: 3000 });
    
    try {
      const phone_text = await overlay.waitForSelector('text="Review your phone"', { timeout: 2000 });
      console.log("Phone confirmation popup found...");
      
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
      console.log("Selected button:", confirm_choice);
      let confirm_button = confirm_choice.ref;
      await confirm_button.click();
      
    } catch (error) {
      console.log("Phone confirmation text not found:", error.message);
    }
  } catch (error) {
    console.log("No phone confirmation popup found:", error.message);
  }
}

async function closeDefaultPopup(page) {
  try {
    console.log("Checking for default popup...");
    const popup = await page.waitForSelector('[data-testid="mask"]', { timeout: 5000 });
    try {
      const closeButton = await popup.waitForSelector('[aria-label="Close"][role="button"]', { timeout: 3000 });
      await closeButton.click();
      console.log('Default popup closed.');
    } catch (error) {
      console.error('No close button found:', error.message);
    }
  } catch (err) {
    console.log('No default popup found:', err.message);
  }
}