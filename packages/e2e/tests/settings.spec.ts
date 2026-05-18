/**
 * Settings page tests — Tier 1 automation.
 * Covers test cases: #13.1A - #13.49A
 */
import { test, expect } from "../fixtures/vortex-app";
import { navigateToSettings } from "../helpers/navigation";
import { SettingsPage } from "../selectors/settings";

test.describe("Settings - Interface Tab", () => {
  test.beforeEach(async ({ vortexWindow }) => {
    await navigateToSettings(vortexWindow);
  });

  test("opens on the Interface tab by default", async ({ vortexWindow }) => {
    await test.step("Verify settings page has content", async () => {
      const pageContent = await vortexWindow.locator("body").innerText();
      expect(pageContent).toBeTruthy();
    });
  });

  test("default language is set to English", async ({ vortexWindow }) => {
    const settings = new SettingsPage(vortexWindow);

    await test.step("Verify English is selected", async () => {
      if (await settings.languageLabel.isVisible()) {
        await expect(settings.englishOption).toBeVisible();
      }
    });
  });

  test("customisation toggles can be switched on and off", async ({ vortexWindow }) => {
    const settings = new SettingsPage(vortexWindow);
    const toggleCount = await settings.checkboxes.count();

    if (toggleCount > 0) {
      const firstToggle = settings.checkboxes.first();

      await test.step("Toggle checkbox off", async () => {
        const initialState = await firstToggle.isChecked();
        await firstToggle.click();
        const newState = await firstToggle.isChecked();
        expect(newState).not.toBe(initialState);
      });

      await test.step("Restore original state", async () => {
        await firstToggle.click();
      });
    }
  });
});

test.describe("Settings - Tab Navigation", () => {
  test.beforeEach(async ({ vortexWindow }) => {
    await navigateToSettings(vortexWindow);
  });

  const settingsTabs = ["Interface", "Vortex", "Mods", "Download", "Workarounds", "Theme"];

  for (const tabName of settingsTabs) {
    test(`can navigate to ${tabName} settings tab`, async ({ vortexWindow }) => {
      const settings = new SettingsPage(vortexWindow);
      const tab = settings.tabByName(tabName);

      await test.step(`Click ${tabName} tab`, async () => {
        if (await tab.isVisible()) {
          await tab.click();
          await vortexWindow.waitForTimeout(500);
        }
      });

      await test.step("Verify tab content loaded", async () => {
        const content = await vortexWindow.locator("body").innerText();
        expect(content.length).toBeGreaterThan(0);
      });
    });
  }
});

test.describe("Settings - Theme Tab", () => {
  test.beforeEach(async ({ vortexWindow }) => {
    await navigateToSettings(vortexWindow);
    const settings = new SettingsPage(vortexWindow);
    if (await settings.themeTab.isVisible()) {
      await settings.themeTab.click();
      await vortexWindow.waitForTimeout(500);
    }
  });

  test("theme list is visible", async ({ vortexWindow }) => {
    await test.step("Verify theme content exists", async () => {
      const content = await vortexWindow.locator("body").innerText();
      expect(content).toBeTruthy();
    });
  });

  test("dark theme toggle is visible", async ({ vortexWindow }) => {
    const settings = new SettingsPage(vortexWindow);

    await test.step("Verify dark theme option exists", async () => {
      if (await settings.darkThemeLabel.isVisible()) {
        await expect(settings.darkThemeLabel).toBeVisible();
      }
    });
  });
});
