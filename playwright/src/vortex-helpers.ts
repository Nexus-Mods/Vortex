/* eslint-disable max-lines-per-function */
import path from 'path';
import fs from 'fs';
import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import { ChildProcess } from 'child_process';

interface WindowInfo {
  url: string;
  width: number;
  height: number;
}

interface VortexLaunchResult {
  app: ElectronApplication;
  mainWindow: Page;
  testRunDir: string;
  appProcess: ChildProcess | null;
  pid: number | undefined;
  userDataDir: string;
}

export async function closeVortex(
  app: ElectronApplication,
  appProcess: ChildProcess | null,
  pid: number | undefined,
  userDataDir?: string
): Promise<void> {
  console.log(`Closing app (PID: ${pid})...`);

  try {
    // Close all windows first
    const windows = app.windows();
    console.log(`Found ${windows.length} window(s) to close`);

    for (const window of windows) {
      try {
        await window.close();
        console.log('Window closed');
      } catch (e) {
        console.log(`Error closing window: ${e}`);
      }
    }

    // Give it a moment
    await new Promise(resolve => setTimeout(resolve, 500));

    // Force kill the process
    if (appProcess && pid) {
      console.log(`Force killing process ${pid}...`);
      try {
        appProcess.kill('SIGKILL');
        console.log(`Process ${pid} killed successfully`);
      } catch (killError) {
        console.log(`Kill error: ${killError}`);
      }
    }

    // Wait a bit for file handles to release
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Clean up user data directory if provided
    if (userDataDir && fs.existsSync(userDataDir)) {
      try {
        console.log(`Cleaning up user data directory: ${userDataDir}`);
        fs.rmSync(userDataDir, { recursive: true, force: true });
        console.log('User data directory cleaned up');
      } catch (cleanupError) {
        console.warn(`Could not clean up user data directory: ${cleanupError}`);
      }
    }
  } catch (error) {
    console.error(`Error during cleanup: ${error}`);
    // Force kill anyway
    if (appProcess && pid) {
      try {
        appProcess.kill('SIGKILL');
      } catch (e) {
        // Ignore
      }
    }
  }
}

export async function waitForMainWindow(app: ElectronApplication): Promise<Page> {
  const splashWindow = await app.firstWindow();
  let mainWindow: Page = splashWindow;
  
  // First, find the main window
  for (let attempts = 0; attempts < 30; attempts++) {
    const windows = app.windows();
    
    if (windows.length > 1) {
      for (const window of windows) {
        const windowInfo: WindowInfo = await window.evaluate(() => ({
          url: (window as any).location.href,
          width: (window as any).outerWidth,
          height: (window as any).outerHeight
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
      const currentInfo: WindowInfo = await windows[0].evaluate(() => ({
        url: (window as any).location.href,
        width: (window as any).outerWidth,
        height: (window as any).outerHeight
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
    const hasReact = (window as any).React || (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    const hasContent = document.body.children.length > 2;
    const hasVortexContent = document.body.textContent!.includes('Vortex') || 
                             document.querySelector('[class*="App"], [class*="application"], [data-testid]') !== null;
    
    return hasContent && (hasReact || hasVortexContent);
  }, { timeout: 40000 });
  
  // Additional wait for async React components to fully render
  console.log('Waiting for React components to fully render...');
  await mainWindow.waitForTimeout(2000);
  
  // Final check - wait for interactive elements to be ready
  await mainWindow.waitForFunction(() => {
    const buttons = document.querySelectorAll('button').length;
    const interactiveElements = document.querySelectorAll('input, select, textarea, [role="button"]').length;
    return buttons > 0 || interactiveElements > 0;
  }, { timeout: 15000 });
  
  return mainWindow;
}

export async function launchVortex(testName: string = 'unknown-test'): Promise<VortexLaunchResult> {
  // Initialize session and reset counter if needed
  initializeTestSession();

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const runNumber = getNextRunNumber();
  const testRunDir = path.join(
    process.cwd(),
    'playwright',
    'test-results',
    `run-${timestamp}-${runNumber.toString().padStart(3, '0')}-${testName}`
  );

  fs.mkdirSync(testRunDir, { recursive: true });

  // Use a unique vortex_playwright directory per test run to avoid locked file issues
  const appdataDir = process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming');
  const userDataDir = path.join(appdataDir, `vortex_playwright_${testName}_${Date.now()}`);

  console.log(`Using user data directory: ${userDataDir}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  const electronPath = process.platform === 'win32'
    ? path.join(process.cwd(), 'node_modules', '.bin', 'electron.cmd')
    : path.join(process.cwd(), 'node_modules', '.bin', 'electron');

  const app = await electron.launch({
    executablePath: electronPath,
    args: ['.', path.join(process.cwd(), 'out', 'main.js'), '--user-data', userDataDir],
    env: {
      ...process.env,
      NODE_ENV: 'development',
      START_DEVTOOLS: 'false',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      NEXUS_DOMAIN: 'cluster.nexdev.uk',
      API_SUBDOMAIN: 'api-staging',
      USERS_SUBDOMAIN: 'users-staging',
      FLAMEWORK_SUBDOMAIN: 'nexusmods-staging',
      NEXT_SUBDOMAIN: 'next-staging',
      PRIVATEBIN_SUBDOMAIN: 'privatebin-staging'
    },
    timeout: 30000
  });

  const mainWindow = await waitForMainWindow(app);

  // Capture process reference for cleanup
  const appProcess = app.process();
  const pid = appProcess?.pid;

  return { app, mainWindow, testRunDir, appProcess, pid, userDataDir };
}

function resetRunCounter(): void {
  const counterFile = path.join(process.cwd(), 'playwright', '.run-counter');
  fs.writeFileSync(counterFile, '0');
}

function getNextRunNumber(): number {
  const counterFile = path.join(process.cwd(), 'playwright', '.run-counter');
  
  let counter = 1;
  if (fs.existsSync(counterFile)) {
    counter = parseInt(fs.readFileSync(counterFile, 'utf8')) + 1;
  }
  
  fs.writeFileSync(counterFile, counter.toString());
  return counter;
}

function initializeTestSession(): void {
  const sessionFile = path.join(process.cwd(), 'playwright', '.test-session');
  const currentPid = process.pid.toString();
  
  // Check if this is a new test session
  if (!fs.existsSync(sessionFile) || fs.readFileSync(sessionFile, 'utf8') !== currentPid) {
    resetRunCounter();
    fs.writeFileSync(sessionFile, currentPid);
  }
}