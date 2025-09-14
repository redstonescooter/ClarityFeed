// functions/init.js
import { chromium } from 'playwright';

export async function initBrowser(logger, existingObjects = null) {
  // If resuming and we already have objects, return them
  if (existingObjects && existingObjects.browser && existingObjects.context && existingObjects.page) {
    console.log('Resuming with existing browser objects...');
    return existingObjects;
  }

  // Get proxy settings from environment variables
  const httpProxy = process.env.WSL_PROXY_HTTP;
  const httpsProxy = process.env.WSL_PROXY_HTTPS;
  const socksProxy = process.env.WSL_PROXY_SOCKS;

  console.log('Proxy settings:', { httpProxy, httpsProxy, socksProxy });

  if (!httpProxy || !httpsProxy || !socksProxy) {
    throw new Error('Proxy settings not found. Please run setup_proxy_wsl.sh first.');
  }

  let browser = null;
  let context = null;
  let page = null;

  try {
    console.log('Launching browser...');
    browser = await chromium.launch({ 
      headless: false,
      proxy: {
        server: httpProxy,
        username: '', // Add if your proxy requires authentication
        password: ''  // Add if your proxy requires authentication
      }
    });

    console.log('Creating browser context...');
    context = await browser.newContext();
    await context.clearCookies();

    console.log('Creating new page...');
    page = await context.newPage();

    // console.log('Navigating to X.com...');
    // console.time('x.com load');
    // await page.goto('https://x.com', { waitUntil: "networkidle" });
    // console.timeEnd('x.com load');

    // // Take initial screenshot
    // await page.screenshot({ path: logger.root_folder + "/initial_screenshot.jpg" });

    // // Get page title
    // const title = await page.title();
    // console.log('Page Title:', title);

    return { browser, context, page };

  } catch (error) {
    // Clean up on error
    try {
      if (page) await page.close();
      if (context) await context.close();
      if (browser) await browser.close();
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }
    throw error;
  }
}