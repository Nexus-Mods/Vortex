/* eslint-disable max-lines-per-function */
import path from 'path';
import fs from 'fs';
import { _electron as electron } from '@playwright/test';

export async function waitForMainWindow(app) {
  const isCI = !!process.env.CI;
  const splashWindow = await app.firstWindow();
  let mainWindow = splashWindow;
  
  console.log(`[${isCI ? 'CI' : 'LOCAL'}] Starting main window detection...`);
  
  // Check if we're stuck on splash screen
  let splashScreenDetected = false;
  let foundMainWindow = false;
  
  // First, find the main window
  for (let attempts = 0; attempts < (isCI ? 60 : 30) && !foundMainWindow; attempts++) {
    console.log(`Attempt ${attempts + 1}/${isCI ? 60 : 30}: Looking for main window...`);
    const windows = app.windows();
    console.log(`Found ${windows.length} window(s)`);
    
    // Capture all window information for debugging
    for (let i = 0; i < windows.length; i++) {
      try {
        const windowInfo = await windows[i].evaluate(() => ({
          url: window.location.href,
          width: window.outerWidth,
          height: window.outerHeight,
          title: document.title,
          readyState: document.readyState
        }));
        
        console.log(`Window ${i}:`, windowInfo);
        
        // Detect if we're on splash screen
        if (windowInfo.url.includes('splash.html')) {
          splashScreenDetected = true;
          console.log('Splash screen detected, waiting for main app...');
          
          // After 30 attempts on splash, something is wrong
          if (attempts > 30) {
            console.log('App appears stuck on splash screen!');
            
            // Try to get main process logs/errors
            try {
              const logs = await app.evaluate(({ app }) => {
                // Try to get any console output or errors
                return {
                  version: app.getVersion(),
                  name: app.getName(),
                  path: app.getAppPath()
                };
              });
              console.log('Main process info:', logs);
            } catch (error) {
              console.log('Could not get main process info:', error.message);
            }
            
            // Take a screenshot of the splash screen
            await windows[i].screenshot({ path: `playwright/stuck-splash-${Date.now()}.png` });
          }
        }
        
        // Look for main window
        if (windowInfo.url.includes('index.html') && 
            windowInfo.width >= 1024 && 
            windowInfo.height >= 700) {
          mainWindow = windows[i];
          foundMainWindow = true;
          console.log('Found main window!');
          break;
        }
      } catch (error) {
        console.log(`Error evaluating window ${i}: ${error.message}`);
      }
    }
    
    // If we found main window, break out of the main loop
    if (foundMainWindow) {
      break;
    }
    
    // If we've been on splash screen too long, try some recovery
    if (splashScreenDetected && attempts > 40) {
      console.log('Attempting to force main window creation...');
      
      // Try clicking on the splash screen (sometimes helps)
      try {
        await splashWindow.click('body');
        console.log('Clicked splash screen');
      } catch (error) {
        console.log('Could not click splash screen:', error.message);
      }
      
      // Try pressing Enter (sometimes splash screens wait for user input)
      try {
        await splashWindow.press('body', 'Enter');
        console.log('Pressed Enter on splash screen');
      } catch (error) {
        console.log('Could not press Enter:', error.message);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, isCI ? 2000 : 1000));
  }
  
  // If we're still on splash screen, throw a helpful error
  if (!foundMainWindow) {
    try {
      const currentUrl = await mainWindow.evaluate(() => location.href);
      if (currentUrl.includes('splash.html')) {
        const errorMsg = `App is stuck on splash screen after ${isCI ? 120 : 60} seconds. This usually means:
1. Main Electron process crashed during startup
2. Missing dependencies required for main app
3. App is waiting for user data directory/permissions
4. GPU/rendering issues preventing main window creation

Check the GitHub Actions logs above for any electron startup errors.`;
        
        throw new Error(errorMsg);
      }
    } catch (evalError) {
      console.log('Could not check current URL:', evalError.message);
    }
    
    throw new Error('Could not find main window within timeout period');
  }
  
  console.log('Waiting for DOM content loaded...');
  const timeout = isCI ? 40000 : 20000; // Longer timeout on CI
  await mainWindow.waitForLoadState('domcontentloaded', { timeout });
  
  console.log('Waiting for React components to mount...');
  // Wait for React components to mount and render
  try {
    await mainWindow.waitForFunction(() => {
      // Check for React-specific indicators
      const hasReact = window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      const hasContent = document.body.children.length > 2;
      const hasVortexContent = document.body.textContent.includes('Vortex') || 
                               document.querySelector('[class*="App"], [class*="application"], [data-testid]') !== null;
      
      // Log current state for debugging
      if (typeof console !== 'undefined') {
        console.log('React check:', {
          hasReact: !!hasReact,
          childrenCount: document.body.children.length,
          hasVortexContent,
          bodyText: document.body.textContent.substring(0, 200)
        });
      }
      
      return hasContent && (hasReact || hasVortexContent);
    }, { timeout: isCI ? 60000 : 40000 }); // Much longer timeout on CI
  } catch (error) {
    console.log('React components timeout. Current page state:');
    try {
      const pageInfo = await mainWindow.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        bodyText: document.body.textContent.substring(0, 500),
        childrenCount: document.body.children.length,
        hasReact: !!(window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__),
        classes: Array.from(document.body.classList)
      }));
      console.log('Page info:', pageInfo);
    } catch (evalError) {
      console.log('Could not evaluate page state:', evalError.message);
    }
    throw error;
  }
  
  console.log('Waiting for components to fully render...');
  await mainWindow.waitForTimeout(isCI ? 5000 : 2000); // Longer wait on CI
  
  console.log('Checking for interactive elements...');
  await mainWindow.waitForFunction(() => {
    const buttons = document.querySelectorAll('button').length;
    const interactiveElements = document.querySelectorAll('input, select, textarea, [role="button"]').length;
    if (typeof console !== 'undefined') {
      console.log('Interactive elements:', { buttons, interactiveElements });
    }
    return buttons > 0 || interactiveElements > 0;
  }, { timeout: isCI ? 30000 : 15000 });
  
  console.log('Main window ready!');
  return mainWindow;
}

export async function launchVortex(testName = 'unknown-test') {
  // Initialize session and reset counter if needed
  initializeTestSession();

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const runNumber = getNextRunNumber();
  const testRunDir = path.join(
    process.cwd(), 
    'playwright', 
    `run-${timestamp}-${runNumber.toString().padStart(3, '0')}-${testName}`
  );
  
  fs.mkdirSync(testRunDir, { recursive: true });

  const electronPath = process.platform === 'win32' 
    ? path.join(process.cwd(), 'node_modules', '.bin', 'electron.cmd')
    : path.join(process.cwd(), 'node_modules', '.bin', 'electron');
  
  const isCI = !!process.env.CI;
  
  // Base args
  let args = ['.', path.join(process.cwd(), 'out', 'main.js')];
  
  // Add CI-specific flags to force headless behavior
  if (isCI) {
    args = args.concat([
      '--disable-gpu',
      '--disable-gpu-sandbox', 
      '--disable-software-rasterizer',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI,BlinkGenPropertyTrees',
      '--disable-ipc-flooding-protection',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--no-zygote',
      '--single-process', // This might help with main process issues
      '--disable-extensions',
      '--disable-default-apps',
      '--disable-background-mode'
    ]);
  }
  
  console.log(`Launching Electron with args: ${args.join(' ')}`);
  
  const app = await electron.launch({ 
    executablePath: electronPath,
    args: args,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      START_DEVTOOLS: 'false',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      // Force headless mode flags
      ...(isCI && {
        DISPLAY: process.env.DISPLAY || ':99',
        ELECTRON_RUN_AS_NODE: undefined, // Ensure we don't run as Node.js
        ELECTRON_NO_ATTACH_CONSOLE: '1'
      })
    },
    timeout: 45000 // Increased timeout for CI
  });
  
  const mainWindow = await waitForMainWindow(app);
  
  return { app, mainWindow, testRunDir };
}

function resetRunCounter() {
  const counterFile = path.join(process.cwd(), 'playwright', '.run-counter');
  fs.writeFileSync(counterFile, '0');
}

function getNextRunNumber() {
  const counterFile = path.join(process.cwd(), 'playwright', '.run-counter');
  
  let counter = 1;
  if (fs.existsSync(counterFile)) {
    counter = parseInt(fs.readFileSync(counterFile, 'utf8')) + 1;
  }
  
  fs.writeFileSync(counterFile, counter.toString());
  return counter;
}

function initializeTestSession() {
  const sessionFile = path.join(process.cwd(), 'playwright', '.test-session');
  const currentPid = process.pid.toString();
  
  // Check if this is a new test session
  if (!fs.existsSync(sessionFile) || fs.readFileSync(sessionFile, 'utf8') !== currentPid) {
    resetRunCounter();
    fs.writeFileSync(sessionFile, currentPid);
  }
}
