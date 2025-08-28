import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test('launch Vortex with organized outputs', async () => {
  // Create unique folder for this test run
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const testRunDir = path.join(process.cwd(), 'playwright', `run-${timestamp}`);
  fs.mkdirSync(testRunDir, { recursive: true });

  const electronPath = process.platform === 'win32' 
    ? path.join(process.cwd(), 'node_modules', '.bin', 'electron.cmd')
    : path.join(process.cwd(), 'node_modules', '.bin', 'electron');
  
  console.log(`Test run folder: ${testRunDir}`);
  console.log('Launching Vortex...');
  
  const app = await electron.launch({ 
    executablePath: electronPath,
    args: [
      '.', 
      path.join(process.cwd(), 'out', 'main.js')
    ],
    env: {
      ...process.env,
      NODE_ENV: 'development',
      START_DEVTOOLS: 'false',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    },
    timeout: 30000
  });
  
  console.log('App launched, waiting for splash screen...');
  
  const splashWindow = await app.firstWindow();
  console.log('Splash screen detected');
  
  await splashWindow.screenshot({ path: path.join(testRunDir, '01-splash.png') });
  
  // Wait for main window
  console.log('Waiting for main window...');
  
  let mainWindow = splashWindow;
  let attempts = 0;
  
  while (attempts < 30) {
    const windows = app.windows();
    console.log(`Found ${windows.length} windows`);
    
    if (windows.length > 1) {
      for (const window of windows) {
        const windowInfo = await window.evaluate(() => ({
          url: window.location.href,
          title: document.title,
          width: window.outerWidth,
          height: window.outerHeight
        }));
        
        if (windowInfo.url.includes('index.html') && 
            windowInfo.width >= 1024 && 
            windowInfo.height >= 700) {
          mainWindow = window;
          console.log('Found Vortex main window');
          break;
        }
      }
      
      if (mainWindow !== splashWindow) {
        break;
      }
    } else if (windows.length === 1) {
      const currentInfo = await windows[0].evaluate(() => ({
        url: window.location.href,
        width: window.outerWidth,
        height: window.outerHeight
      }));
      
      if (currentInfo.url.includes('index.html') || 
         (currentInfo.width >= 1024 && currentInfo.height >= 700)) {
        mainWindow = windows[0];
        console.log('Splash transformed to main window');
        break;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  
  // Wait for React to load
  console.log('Waiting for React app to load...');
  await mainWindow.waitForLoadState('domcontentloaded', { timeout: 20000 });
  
  await mainWindow.screenshot({ path: path.join(testRunDir, '02-loading.png') });
  
  // Wait for Vortex UI to fully render
  await mainWindow.waitForFunction(() => {
    return document.body.textContent.includes('Vortex') ||
           document.querySelector('[class*="application"], [class*="main"], [data-testid]') !== null ||
           document.body.children.length > 2;
  }, { timeout: 30000 });
  
  console.log('Waiting for full React render...');
  await mainWindow.waitForTimeout(5000);
  
  await mainWindow.screenshot({ path: path.join(testRunDir, '03-final.png') });
  
  // Save debugging info
  const pageContent = await mainWindow.content();
  const finalInfo = await mainWindow.evaluate(() => ({
    title: document.title,
    url: window.location.href,
    width: window.outerWidth,
    height: window.outerHeight,
    contentPreview: document.body.textContent.substring(0, 200),
    elementCount: document.body.querySelectorAll('*').length,
    timestamp: new Date().toISOString()
  }));
  
  fs.writeFileSync(path.join(testRunDir, 'page-content.html'), pageContent);
  fs.writeFileSync(path.join(testRunDir, 'window-info.json'), JSON.stringify(finalInfo, null, 2));
  
  console.log('Final Vortex window:', finalInfo);
  
  await app.close();
  console.log('Test completed successfully!');
  console.log(`Test artifacts saved to: ${testRunDir}`);
});