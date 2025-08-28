/* eslint-disable max-lines-per-function */
import path from 'path';
import fs from 'fs';
import { _electron as electron } from '@playwright/test';

export async function waitForMainWindow(app) {
  const splashWindow = await app.firstWindow();
  let mainWindow = splashWindow;
  
  // First, find the main window
  for (let attempts = 0; attempts < 30; attempts++) {
    const windows = app.windows();
    
    if (windows.length > 1) {
      for (const window of windows) {
        const windowInfo = await window.evaluate(() => ({
          url: window.location.href,
          width: window.outerWidth,
          height: window.outerHeight
        }));
        
        if (windowInfo.url.includes('index.html') && 
            windowInfo.width >= 1024 && 
            windowInfo.height >= 700) {
          mainWindow = window;
          break;
        }
      }
      if (mainWindow !== splashWindow) break;
    } else if (windows.length === 1) {
      const currentInfo = await windows[0].evaluate(() => ({
        url: window.location.href,
        width: window.outerWidth,
        height: window.outerHeight
      }));
      
      if (currentInfo.url.includes('index.html') || 
         (currentInfo.width >= 1024 && currentInfo.height >= 700)) {
        mainWindow = windows[0];
        break;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Now wait for React to fully render
  await mainWindow.waitForLoadState('domcontentloaded', { timeout: 20000 });
  
  // Wait for React components to mount and render
  await mainWindow.waitForFunction(() => {
    // Check for React-specific indicators
    const hasReact = window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    const hasContent = document.body.children.length > 2;
    const hasVortexContent = document.body.textContent.includes('Vortex') || 
                             document.querySelector('[class*="App"], [class*="application"], [data-testid]') !== null;
    
    return hasContent && (hasReact || hasVortexContent);
  }, { timeout: 40000 }); // Increased to 40 seconds
  
  // Additional wait for async React components to fully render
  console.log('Waiting for React components to fully render...');
  await mainWindow.waitForTimeout(2000); // Increased from previous waits
  
  // Final check - wait for interactive elements to be ready
  await mainWindow.waitForFunction(() => {
    const buttons = document.querySelectorAll('button').length;
    const interactiveElements = document.querySelectorAll('input, select, textarea, [role="button"]').length;
    return buttons > 0 || interactiveElements > 0;
  }, { timeout: 15000 });
  
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
