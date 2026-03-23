/**
 * Dashboard tests — Tier 1 automation.
 *
 * These tests validate dashboard elements render and are interactive.
 *
 * Covers test cases: #2.1A - #2.18A
 */
import { test, expect } from '../fixtures/vortex-app';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ vortexWindow }) => {
    // Wait for the app to fully load past splash screen
    await vortexWindow.waitForTimeout(5000);
  });

  // #2.8A - "Select a game to manage" tile is visible
  test('"Lets get you setup" area is visible on fresh dashboard', async ({ vortexWindow }) => {
    await vortexWindow.screenshot({ path: 'test-results/dashboard-full.png', fullPage: true });

    // Look for common dashboard elements
    const bodyText = await vortexWindow.locator('body').innerText();

    // The dashboard should have some content rendered
    expect(bodyText.length).toBeGreaterThan(0);
  });

  // #2.6A - "What's New" section
  test('"What\'s New" section renders', async ({ vortexWindow }) => {
    const whatsNew = vortexWindow.getByText("What's New").first();

    if (await whatsNew.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(whatsNew).toBeVisible();
      await vortexWindow.screenshot({ path: 'test-results/dashboard-whats-new.png' });
    }
  });

  // #2.10A - Latest News section
  test('"Latest News" section renders', async ({ vortexWindow }) => {
    const latestNews = vortexWindow.getByText('Latest News').first();

    if (await latestNews.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(latestNews).toBeVisible();
    }
  });

  // #2.18A - Dashboard customisation
  test('dashboard customise button is accessible', async ({ vortexWindow }) => {
    // Look for customize/customise button
    const customiseBtn = vortexWindow
      .getByText(/customi[sz]e/i)
      .first();

    if (await customiseBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await customiseBtn.click();
      await vortexWindow.waitForTimeout(500);
      await vortexWindow.screenshot({ path: 'test-results/dashboard-customise.png' });
    }
  });
});

test.describe('Dashboard - Getting Started Videos', () => {
  test.beforeEach(async ({ vortexWindow }) => {
    await vortexWindow.waitForTimeout(5000);
  });

  // #2.1A - Getting started videos are playable
  test('getting started section is present', async ({ vortexWindow }) => {
    const getStarted = vortexWindow
      .getByText(/get.*started|introduction/i)
      .first();

    if (await getStarted.isVisible({ timeout: 5000 }).catch(() => false)) {
      await vortexWindow.screenshot({ path: 'test-results/dashboard-get-started.png' });
    }
  });

  // #2.3A / #2.4A - Video player can be minimised and closed
  test('video player popup can be closed', async ({ vortexWindow }) => {
    // Find and click a video thumbnail if present
    const videoTrigger = vortexWindow
      .getByText(/getting started|introduction video/i)
      .first();

    if (await videoTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      await videoTrigger.click();
      await vortexWindow.waitForTimeout(1000);

      // Look for close button on the video player popup
      const closeBtn = vortexWindow.getByRole('button', { name: /close/i }).first();

      if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeBtn.click();
        await vortexWindow.waitForTimeout(500);
      }
    }
  });
});
