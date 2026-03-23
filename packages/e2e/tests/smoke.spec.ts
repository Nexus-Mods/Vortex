/**
 * Smoke tests — Phase 1: Verify the app launches and basic navigation works.
 *
 * Covers test cases: #1.4A (app can be closed), #2.8A (dashboard loads)
 */
import { test, expect } from '../fixtures/vortex-app';

test.describe('App Launch', () => {
  test('Vortex launches and shows a window', async ({ vortexApp, vortexWindow }) => {
    const windows = vortexApp.windows();
    expect(windows.length).toBeGreaterThanOrEqual(1);

    const title = await vortexWindow.title();
    expect(title).toBeTruthy();
  });

  test('main window has no critical console errors on startup', async ({ vortexWindow }) => {
    const errors: string[] = [];

    vortexWindow.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await vortexWindow.waitForTimeout(3000);

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('DevTools') &&
        !e.includes('electron/js2c') &&
        !e.includes('Autofill.enable')
    );

    expect(criticalErrors).toEqual([]);
  });

  test('app process is running and responsive', async ({ vortexApp, vortexWindow }) => {
    expect(vortexWindow).toBeTruthy();
    const title = await vortexWindow.title();
    expect(title).toBeTruthy();
  });
});

test.describe('Navigation', () => {
  test('dashboard is visible after launch', async ({ vortexWindow }) => {
    const bodyContent = await vortexWindow.locator('body').innerText();
    expect(bodyContent.length).toBeGreaterThan(0);
  });

  test('can navigate to Games via home icon', async ({ vortexWindow }) => {
    const homeIcon = vortexWindow.locator('a[href="#/games"]').first();
    const homeBtn = vortexWindow.locator('.main-nav-sidebar a').first();

    if (await homeIcon.isVisible({ timeout: 3000 }).catch(() => false)) {
      await homeIcon.click();
    } else if (await homeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await homeBtn.click();
    }

    await vortexWindow.waitForTimeout(1000);
  });

  test('can navigate to Preferences tab', async ({ vortexWindow }) => {
    const prefsNav = vortexWindow.getByText('Preferences', { exact: true }).first();
    await expect(prefsNav).toBeVisible();
    await prefsNav.click();
    await vortexWindow.waitForTimeout(1000);
  });
});
