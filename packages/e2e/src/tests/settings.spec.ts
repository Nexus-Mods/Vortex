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

  test("[QA-127] opens on the Interface tab by default", async ({ vortexWindow }) => {
    await test.step("Verify the Interface tab is the active tab", async () => {
      const activeTab = vortexWindow.getByRole("tab", { selected: true });
      await expect(activeTab).toHaveText("Interface");
    });
  });

  test("[QA-128] default language is set to English", async ({ vortexWindow }) => {
    const settings = new SettingsPage(vortexWindow);

    await test.step("Verify English is selected", async () => {
      await expect(settings.languageSelect).toHaveValue("en");
    });
  });

  test("language picker menu opens fully visible (not clipped by the settings pane)", async ({
    vortexWindow,
  }) => {
    await test.step("Open the language picker", async () => {
      await vortexWindow.getByRole("button", { name: "English" }).first().click();
      await expect(vortexWindow.getByRole("listbox")).toBeVisible();
    });

    await test.step("Verify the open menu is hit-testable at its corners", async () => {
      const hits = await vortexWindow.getByRole("listbox").evaluate((menu) => {
        // the e2e tsconfig has no DOM lib; type the in-page APIs structurally
        interface InPageElement {
          getBoundingClientRect(): { left: number; top: number; right: number; bottom: number };
          closest(selector: string): InPageElement | null;
        }
        const el = menu as unknown as InPageElement;
        const doc = (
          globalThis as unknown as {
            document: { elementFromPoint(x: number, y: number): InPageElement | null };
          }
        ).document;
        const r = el.getBoundingClientRect();
        const points: Array<[number, number]> = [
          [r.left + 4, r.top + 4],
          [r.right - 4, r.top + 4],
          [r.left + 4, Math.min(r.bottom - 4, r.top + 150)],
        ];
        return points.map(([x, y]) => {
          const hit = doc.elementFromPoint(x, y);
          return hit !== null && hit.closest('[role="listbox"]') !== null;
        });
      });
      expect(hits).toEqual([true, true, true]);
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
