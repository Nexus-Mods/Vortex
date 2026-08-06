/**
 * Health Check — general screen behaviour + settings (LAZ-684).
 *
 * Covers the parts of the screen that are deterministic without special
 * requirement test-data: the empty/passed state, the header and its controls,
 * refresh, the Settings toggles (and their within-session persistence), and the
 * free-vs-premium chrome. The requirement warning / detail / install flows live
 * in the sibling health-check-file-requirement.spec.ts.
 *
 * Assertions use the strings the app actually ships (locales/en/health_check.json).
 */
import { test, expect } from "../fixtures/vortex-app";
import { navigateToHealthCheck, navigateToSettings } from "../helpers/navigation";
import { Timeouts } from "../helpers/timeouts";
import { freeUser, premiumUser } from "../helpers/users";
import { Header } from "../selectors/header";
import { HealthCheckPage, HealthCheckSettings } from "../selectors/healthCheck";
import { SettingsPage } from "../selectors/settings";

test.describe("Health Check - screen behaviour and settings", () => {
  test.describe("free user", () => {
    test.use({ nexusUser: freeUser });

    test("Check the passed state is shown when there are no issues", async ({
      vortexWindow,
      managedGame: _game,
    }) => {
      const hc = new HealthCheckPage(vortexWindow);

      await test.step("Open the Health Check page", async () => {
        await navigateToHealthCheck(vortexWindow);
        await expect(hc.title).toBeVisible();
      });

      await test.step("Passed-state title is shown", async () => {
        await expect(hc.emptyStateTitle).toBeVisible();
      });

      await test.step("Passed-state message is shown", async () => {
        await expect(hc.emptyStateMessage).toBeVisible();
      });
    });

    test("Check the header shows the title, subtitle, beta badge and controls", async ({
      vortexWindow,
      managedGame: _game,
    }) => {
      const hc = new HealthCheckPage(vortexWindow);

      await test.step("Open the Health Check page", async () => {
        await navigateToHealthCheck(vortexWindow);
        await expect(hc.title).toBeVisible();
      });

      await test.step("Subtitle is shown", async () => {
        await expect(hc.subtitle).toBeVisible();
      });

      await test.step("Beta badge is shown", async () => {
        await expect(hc.betaBadge).toBeVisible();
      });

      await test.step("Refresh control is shown", async () => {
        await expect(hc.refreshButton).toBeVisible();
      });

      await test.step("Settings control is shown", async () => {
        await expect(hc.settingsButton).toBeVisible();
      });
    });

    test("Check refresh re-runs the check and shows the last-updated time", async ({
      vortexWindow,
      managedGame: _game,
    }) => {
      const hc = new HealthCheckPage(vortexWindow);

      await test.step("Open the Health Check page", async () => {
        await navigateToHealthCheck(vortexWindow);
        await expect(hc.refreshButton).toBeVisible();
      });

      await test.step("Refresh and confirm the last-updated timestamp appears", async () => {
        await hc.refreshButton.click();
        await expect(hc.lastUpdated).toBeVisible({ timeout: Timeouts.NETWORK });
      });
    });

    test("Check the settings gear opens Settings at the Health Check section", async ({
      vortexWindow,
      managedGame: _game,
    }) => {
      const hc = new HealthCheckPage(vortexWindow);

      await test.step("Open the Health Check page", async () => {
        await navigateToHealthCheck(vortexWindow);
        await expect(hc.settingsButton).toBeVisible();
      });

      await test.step("Click the settings gear", async () => {
        await hc.settingsButton.click();
        await expect(new HealthCheckSettings(vortexWindow).sectionTitle).toBeVisible();
      });
    });

    test("Check the premium banner is shown", async ({ vortexWindow, managedGame: _game }) => {
      const hc = new HealthCheckPage(vortexWindow);

      await test.step("Open the Health Check page", async () => {
        await navigateToHealthCheck(vortexWindow);
        await expect(hc.title).toBeVisible();
      });

      await test.step("Premium banner is shown", async () => {
        await expect(hc.premiumBanner).toBeVisible();
      });
    });

    test("Check the settings expose the mod- and file-requirement toggles", async ({
      vortexWindow,
    }) => {
      await test.step("Open Settings and switch to the Vortex tab", async () => {
        await navigateToSettings(vortexWindow);
        await new SettingsPage(vortexWindow).vortexTab.click();
        await expect(new HealthCheckSettings(vortexWindow).sectionTitle).toBeVisible();
      });

      const settings = new HealthCheckSettings(vortexWindow);

      await test.step("Mod-requirements toggle is shown", async () => {
        await expect(settings.modRequirementsToggle).toBeVisible();
      });

      await test.step("File-requirements toggle is shown", async () => {
        await expect(settings.fileRequirementsToggle).toBeVisible();
      });
    });

    test("Check the file-requirements toggle flips and persists within the session", async ({
      vortexWindow,
    }) => {
      await test.step("Open Settings and switch to the Vortex tab", async () => {
        await navigateToSettings(vortexWindow);
        await new SettingsPage(vortexWindow).vortexTab.click();
        await expect(new HealthCheckSettings(vortexWindow).fileRequirementsToggle).toBeVisible();
      });

      const settings = new HealthCheckSettings(vortexWindow);

      await test.step("Toggle starts enabled", async () => {
        await expect(settings.fileRequirementsToggle).toHaveClass(/toggle-on/);
      });

      await test.step("Turn it off", async () => {
        await settings.fileRequirementsToggle.click();
        await expect(settings.fileRequirementsToggle).toHaveClass(/toggle-off/);
      });

      await test.step("Leave to the Interface tab", async () => {
        await new SettingsPage(vortexWindow).interfaceTab.click();
        await expect(new HealthCheckSettings(vortexWindow).sectionTitle).toBeHidden();
      });

      await test.step("Return to the Vortex tab and confirm the toggle is still off", async () => {
        await new SettingsPage(vortexWindow).vortexTab.click();
        await expect(new HealthCheckSettings(vortexWindow).fileRequirementsToggle).toHaveClass(
          /toggle-off/,
        );
      });
    });
  });

  test.describe("premium user", () => {
    test.use({ nexusUser: premiumUser });

    test("Check the premium indicator is shown and the banner is hidden", async ({
      vortexWindow,
      managedGame: _game,
    }) => {
      const hc = new HealthCheckPage(vortexWindow);

      await test.step("Open the Health Check page", async () => {
        await navigateToHealthCheck(vortexWindow);
        await expect(hc.title).toBeVisible();
      });

      await test.step("Premium indicator is shown in the top bar", async () => {
        await expect(new Header(vortexWindow).premiumIndicator).toBeVisible();
      });

      await test.step("Premium banner is not shown", async () => {
        await expect(hc.premiumBanner).toHaveCount(0);
      });
    });
  });
});
