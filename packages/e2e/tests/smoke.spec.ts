/**
 * Smoke tests — Verify the app launches and basic navigation works.
 * Covers test cases: #1.4A, #2.8A
 */
import { test, expect } from "../fixtures/vortex-app";
import { navigateToSettings, navigateToGames } from "../helpers/navigation";
import { NavBar } from "../selectors/navbar";

test.describe("App Launch", () => {
  test("Vortex launches and shows a window @smoke", async ({ vortexApp, vortexWindow }) => {
    await test.step("Verify window exists", async () => {
      const windows = vortexApp.windows();
      expect(windows.length).toBeGreaterThanOrEqual(1);
    });

    await test.step("Verify window has a title", async () => {
      const title = await vortexWindow.title();
      expect(title).toBeTruthy();
    });
  });

  test("main window has no critical console errors on startup @smoke", async ({ vortexWindow }) => {
    const errors: string[] = [];

    vortexWindow.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await vortexWindow.waitForTimeout(3000);

    await test.step("Check for critical errors", async () => {
      const criticalErrors = errors.filter(
        (e) =>
          !e.includes("DevTools") && !e.includes("electron/js2c") && !e.includes("Autofill.enable"),
      );
      expect(criticalErrors).toEqual([]);
    });
  });

  test("app process is running and responsive @smoke", async ({ vortexWindow }) => {
    await test.step("Verify process is responsive", async () => {
      expect(vortexWindow).toBeTruthy();
      const title = await vortexWindow.title();
      expect(title).toBeTruthy();
    });
  });
});

test.describe("Navigation", () => {
  test("dashboard is visible after launch @smoke", async ({ vortexWindow }) => {
    await test.step("Verify dashboard content", async () => {
      const bodyContent = await vortexWindow.locator("body").innerText();
      expect(bodyContent.length).toBeGreaterThan(0);
    });
  });

  test("can navigate to Games page", async ({ vortexWindow }) => {
    await test.step("Navigate to Games", async () => {
      await navigateToGames(vortexWindow);
    });
  });

  test("can navigate to Settings/Preferences page", async ({ vortexWindow }) => {
    const navbar = new NavBar(vortexWindow);

    await test.step("Verify settings link is visible", async () => {
      await expect(navbar.settingsLink).toBeVisible();
    });

    await test.step("Navigate to settings", async () => {
      await navigateToSettings(vortexWindow);
    });
  });
});
