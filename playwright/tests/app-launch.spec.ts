import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { launchVortex, closeVortex } from '../src/vortex-helpers';

interface AppInfo {
  title: string;
  url: string;
  width: number;
  height: number;
  contentPreview: string;
}

test('app launches successfully', async () => {

  const { app, mainWindow, testRunDir, appProcess, pid } = await launchVortex('app-launch');

  try {
    await mainWindow.screenshot({ path: path.join(testRunDir, 'app-loaded.png') });

    const finalInfo: AppInfo = await mainWindow.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      width: window.outerWidth,
      height: window.outerHeight,
      contentPreview: document.body.textContent!.substring(0, 200)
    }));

    console.log('App launch info:', finalInfo);
    fs.writeFileSync(path.join(testRunDir, 'launch-info.json'), JSON.stringify(finalInfo, null, 2));

    expect(finalInfo.title).toBeTruthy();
    expect(finalInfo.url).toContain('index.html');

  } finally {
    await closeVortex(app, appProcess, pid);
    console.log(`Test completed. Results in: ${testRunDir}`);
  }
});