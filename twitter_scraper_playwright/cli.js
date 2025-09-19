// cli.js
import readline from 'readline';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import { initBrowser } from './functions/init.js';
import { loginToTwitter } from './functions/login.js';
import { getTweets } from './functions/tweets.js';
import { Logger } from '../utils/log.js';

dotenvConfig({ path: path.resolve('/root/programming/clarityFeed/.env') });

class TwitterCLI {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.logger = new Logger();
    this.currentFunction = null;
    this.isPaused = false;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log('\n=== Twitter Scraper CLI ===');
    await this.showMainMenu();
  }

  async showMainMenu() {
    if (this.isPaused) {
      await this.showPauseMenu();
      return;
    }

    console.log('\nMain Menu:');
    console.log('1. Initialize Browser');
    console.log('2. Login to Twitter');
    console.log('3. Get Tweets');
    console.log('0. Pause Mode');
    console.log('q. Quit');

    const choice = await this.getUserInput('\nEnter your choice (1/2/3/0/q): ');
    await this.handleMainMenuChoice(choice.trim().toLowerCase());
  }

  async showPauseMenu() {
    console.log('\n=== PAUSE MODE ===');
    console.log('Browser window is kept open for manual interaction.');
    if (this.currentFunction) {
      console.log(`Current function: ${this.currentFunction}`);
    }
    console.log('\nPause Menu Options:');
    console.log('1. Resume previous function and return to main menu');
    console.log('2. Abort previous function and return to main menu');
    console.log('3. Restart previous function and return to main menu');
    console.log('q. Quit');

    const choice = await this.getUserInput('\nEnter your choice (1/2/3/q): ');
    await this.handlePauseMenuChoice(choice.trim().toLowerCase());
  }

  async handleMainMenuChoice(choice) {
    try {
      switch (choice) {
        case '1':
          this.currentFunction = 'init';
          await this.executeInit();
          break;
        case '2':
          this.currentFunction = 'login';
          await this.executeLogin();
          break;
        case '3':
          this.currentFunction = 'getTweets';
          await this.executeGetTweets();
          break;
        case '0':
          await this.enterPauseMode();
          break;
        case 'q':
          await this.quit();
          return;
        default:
          console.log('Invalid choice. Please try again.');
      }
    } catch (error) {
      console.error(`Error executing ${this.currentFunction}:`, error.message);
    }
    
    if (!this.isPaused) {
      this.currentFunction = null;
      await this.showMainMenu();
    }
  }

  async handlePauseMenuChoice(choice) {
    switch (choice) {
      case '1':
        // Resume previous function
        console.log('Resuming previous function...');
        this.isPaused = false;
        if (this.currentFunction) {
          await this.executeFunction(this.currentFunction, true); // resume = true
        }
        break;
      case '2':
        // Abort previous function
        console.log('Aborting previous function...');
        this.isPaused = false;
        this.currentFunction = null;
        break;
      case '3':
        // Restart previous function
        console.log('Restarting previous function...');
        this.isPaused = false;
        if (this.currentFunction) {
          await this.executeFunction(this.currentFunction, false); // resume = false
        }
        break;
      case 'q':
        await this.quit();
        return;
      default:
        console.log('Invalid choice. Please try again.');
    }
    
    if (!this.isPaused) {
      this.currentFunction = null;
    }
    await this.showMainMenu();
  }

  async executeFunction(functionName, resume = false) {
    try {
      switch (functionName) {
        case 'init':
          await this.executeInit(resume);
          break;
        case 'login':
          await this.executeLogin(resume);
          break;
        case 'getTweets':
          await this.executeGetTweets(resume);
          break;
      }
    } catch (error) {
      console.error(`Error executing ${functionName}:`, error.message);
    }
  }

  async executeInit(resume = false) {
    try {
      console.log('Initializing browser...');
      const result = await initBrowser(this.logger, resume ? { 
        browser: this.browser, 
        context: this.context, 
        page: this.page 
      } : null);
      
      this.browser = result.browser;
      this.context = result.context;
      this.page = result.page;
      
      console.log('Browser initialized successfully!');
    } catch (error) {
      console.error('Init failed:', error.message);
      throw error;
    }
  }

  async executeLogin(resume = false) {
    if (!this.page) {
      console.log('Browser not initialized. Please run init first.');
      return;
    }
    
    try {
      console.log('Logging into Twitter...');
      await loginToTwitter(this.page,this.logger, resume);
      console.log('Login completed successfully!');
    } catch (error) {
      console.error('Login failed:', error.message);
      throw error;
    }
  }

  async executeGetTweets(resume = false) {
    if (!this.page) {
      console.log('Browser not initialized. Please run init first.');
      return;
    }
    
    try {
      console.log('Getting tweets...');
      await getTweets(this.page,this.logger, resume);
      console.log('Tweets retrieved successfully!');
    } catch (error) {
      console.error('Get tweets failed:', error.message);
      throw error;
    }
  }

  async enterPauseMode() {
    console.log('\n=== ENTERING PAUSE MODE ===');
    console.log('You can now manually interact with the browser window.');
    console.log('The browser will remain open until you choose an option from the pause menu.');
    this.isPaused = true;
  }

  async getUserInput(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  async quit() {
    console.log('Cleaning up and exiting...');
    try {
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }
    
    this.rl.close();
    process.exit(0);
  }
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT. Cleaning up...');
  process.exit(0);
});

// Start the CLI
const cli = new TwitterCLI();
cli.start().catch((error) => {
  console.error('CLI startup error:', error);
  process.exit(1);
});