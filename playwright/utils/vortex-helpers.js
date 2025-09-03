/* eslint-disable max-lines-per-function */
import path from 'path';
import fs from 'fs';
import { _electron as electron } from '@playwright/test';

export async function waitForMainWindow(app) {
  const isCI = !!process.env.CI;
  const splashWindow = await app.firstWindow();
  let mainWindow = splashWindow;
  
  console.log(`[${isCI ? 'CI' : 'LOCAL'}] Starting main window detection...`);
  
  // First, find the main window
  for (let attempts = 0; attempts < 30; attempts++) {
    console.log(`Attempt ${attempts + 1}/30: Looking for main window...`);
    const windows = app.windows();
    console.log(`Found ${windows.length} window(s)`);
    
    if (windows.length > 1) {
      for (const window of windows) {
        try {
          const windowInfo = await window.evaluate(() => ({
            url: window.location.href,
            width: window.outerWidth,
            height: window.outerHeight
          }));
          
          console.log(`Window info:`, windowInfo);
          
          if (windowInfo.url.includes('index.html') && 
              windowInfo.width >= 1024 && 
              windowInfo.height >= 700) {
            mainWindow = window;
            console.log('✓ Found main window!');
            break;
          }
        } catch (error) {
          console.log(`Error evaluating window: ${error.message}`);
        }
      }
      if (mainWindow !== splashWindow) break;
    } else if (windows.length === 1) {
      try {
        const currentInfo = await windows[0].evaluate(() => ({
          url: window.location.href,
          width: window.outerWidth,
          height: window.outerHeight
        }));
        
        console.log(`Single window info:`, currentInfo);
        
        if (currentInfo.url.includes('index.html') || 
           (currentInfo.width >= 1024 && currentInfo.height >= 700)) {
          mainWindow = windows[0];
          console.log('✓ Using single window as main window!');
          break;
        }
      } catch (error) {
        console.log(`Error evaluating single window: ${error.message}`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
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
      console.log('React check:', {
        hasReact: !!hasReact,
        childrenCount: document.body.children.length,
        hasVortexContent,
        bodyText: document.body.textContent.substring(0, 200)
      });
      
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
    console.log('Interactive elements:', { buttons, interactiveElements });
    return buttons > 0 || interactiveElements > 0;
  }, { timeout: isCI ? 30000 : 15000 });
  
  console.log('✓ Main window ready!');
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
  
  const app = await electron.launch({ 
    executablePath: electronPath,
    args: ['.', path.join(process.cwd(), 'out', 'main.js')],
    env: {
      ...process.env,
      NODE_ENV: 'development',
      START_DEVTOOLS: 'false',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    },
    timeout: 30000
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
