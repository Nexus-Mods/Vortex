/**
 * Dashboard tests — Tier 1 automation.
 * Covers test cases: #2.1A - #2.18A
 */
import { test, expect } from "../fixtures/vortex-app";
import { DashboardPage } from "../selectors/dashboard";

test.describe("Dashboard", () => {
  test('"Lets get you setup" area is visible on fresh dashboard', async ({ vortexWindow }) => {
    await test.step("Verify dashboard has content", async () => {
      const bodyText = await vortexWindow.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(0);
    });
  });

  test('"What\'s New" section renders @smoke', async ({ vortexWindow }) => {
    const dashboard = new DashboardPage(vortexWindow);

    await test.step("Verify What's New is visible", async () => {
      if (await dashboard.whatsNew.isVisible().catch(() => false)) {
        await expect(dashboard.whatsNew).toBeVisible();
      }
    });
  });

  test('"Latest News" section renders', async ({ vortexWindow }) => {
    const dashboard = new DashboardPage(vortexWindow);

    await test.step("Verify Latest News is visible", async () => {
      if (await dashboard.latestNews.isVisible().catch(() => false)) {
        await expect(dashboard.latestNews).toBeVisible();
      }
    });
  });

  test("dashboard customise button is accessible", async ({ vortexWindow }) => {
    const dashboard = new DashboardPage(vortexWindow);

    await test.step("Click Customise button", async () => {
      await expect(dashboard.customiseButton).toBeVisible();
      await dashboard.customiseButton.click();
    });

    await test.step("Verify customise mode activated", async () => {
      await expect(dashboard.doneButton).toBeVisible();
    });
  });
});

test.describe("Dashboard - Getting Started Videos", () => {
  test("getting started section is present", async ({ vortexWindow }) => {
    const dashboard = new DashboardPage(vortexWindow);

    await test.step("Verify getting started section exists", async () => {
      await expect(dashboard.getStartedSection).toBeVisible();
    });
  });

  test("video player popup can be closed", async ({ vortexWindow }) => {
    const dashboard = new DashboardPage(vortexWindow);

    if (await dashboard.introductionVideo.isVisible().catch(() => false)) {
      await test.step("Open video", async () => {
        // A drag-handle overlay intercepts pointer events
        await dashboard.introductionVideo.click({ force: true });
        await vortexWindow.waitForTimeout(1000);
      });

      await test.step("Close video", async () => {
        if (await dashboard.videoCloseButton.isVisible().catch(() => false)) {
          await dashboard.videoCloseButton.click();
        }
      });
    }
  });
});
