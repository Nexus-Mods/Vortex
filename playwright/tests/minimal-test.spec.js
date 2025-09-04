import { test } from '@playwright/test';
import { _electron as electron } from '@playwright/test';
import path from 'path';

test('minimal electron launch - find main window', async () => {
  const isCI = !!process.env.CI;
  console.log('Is CI environment:', isCI);
  
  const electronPath = process.platform === 'win32' 
    ? path.join(process.cwd(), 'node_modules', '.bin', 'electron.cmd')
    : path.join(process.cwd(), 'node_modules', '.bin', 'electron');

  console.log('Electron path:', electronPath);
  console.log('Main.js path:', path.join(process.cwd(), 'out', 'main.js'));
  
  // Very basic args for CI
  const args = [
    '.',
    path.join(process.cwd(), 'out', 'main.js'),
    ...(isCI ? [
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=swiftshader-webgl'
    ] : [])
  ];
  
  console.log('Launch args:', args);

  let app;
  try {
    console.log('Attempting to launch Electron...');
    
    app = await electron.launch({ 
      executablePath: electronPath,
      args: args,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
        ...(isCI && { CI: 'true' })
      },
      timeout: 60000
    });
    
    console.log('Electron launched successfully!');
    
    // Wait a bit for windows to appear and settle
    await app.firstWindow();
    console.log('Got first window, waiting for all windows to load...');
    
    // Wait up to 30 seconds for the main window to appear
    let mainWindow = null;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (mainWindow === null && attempts < maxAttempts) {
      const windows = app.windows();
      console.log(`Attempt ${attempts + 1}: Found ${windows.length} window(s)`);
      
      // Check each window
      for (let i = 0; i < windows.length; i++) {
        try {
          const windowInfo = await windows[i].evaluate(() => ({
            url: window.location.href,
            title: document.title,
            readyState: document.readyState,
            width: window.outerWidth,
            height: window.outerHeight
          }));
          
          console.log(`Window ${i}:`, windowInfo);
          
          // Look for main window (index.html and reasonable size)
          if (windowInfo.url.includes('index.html') && 
              windowInfo.width >= 1024 && 
              windowInfo.height >= 700) {
            mainWindow = windows[i];
            console.log(`Found main window at index ${i}!`);
            break;
          }
        } catch (error) {
          console.log(`Error evaluating window ${i}: ${error.message}`);
        }
      }
      
      if (mainWindow === null) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (mainWindow === null) {
      console.error('Never found main window after 30 attempts');
      // Take screenshots of all windows for debugging
      const windows = app.windows();
      for (let i = 0; i < windows.length; i++) {
        try {
          await windows[i].screenshot({ path: `debug-window-${i}.png` });
          console.log(`Screenshot taken for window ${i}`);
        } catch (error) {
          console.log(`Failed to screenshot window ${i}: ${error.message}`);
        }
      }
      throw new Error('Main window never appeared');
    }
    
    // Test the main window
    await mainWindow.screenshot({ path: 'main-window-found.png' });
    console.log('Main window screenshot taken');
    
    // Get final window state
    const finalInfo = await mainWindow.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
      bodyText: document.body ? document.body.textContent.substring(0, 200) : 'No body',
      width: window.outerWidth,
      height: window.outerHeight
    }));
    
    console.log('Final main window info:', finalInfo);
    
    // Simple test - make sure we got the main window
    if (!finalInfo.url.includes('index.html')) {
      throw new Error(`Expected main window (index.html) but got: ${finalInfo.url}`);
    }
    
    console.log('SUCCESS: Main window found and working!');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Error stack:', error.stack);
    throw error;
  } finally {
    if (app) {
      console.log('Closing app...');
      try {
        await app.close();
        console.log('App closed successfully');
      } catch (closeError) {
        console.error('Error closing app:', closeError.message);
      }
    }
  }
});