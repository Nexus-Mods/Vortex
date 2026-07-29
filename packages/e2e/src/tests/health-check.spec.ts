/**
 * File Requirements Health Check — foundation E2E coverage (LAZ-684).
 *
 * These cover the parts of the feature that are deterministic without special
 * requirement test-data: the empty/passed state, header controls, the Settings
 * toggles, and the free-vs-premium chrome. The warning / suggestion / install /
 * version / hide flows (TC-01, TC-05..TC-23, TC-27..TC-36) need an installed mod
 * with unsatisfied file-level requirement metadata and are tracked as follow-up.
 *
 * TC references map to the behaviour spec in the LAZ-684 comment. Assertions use
 * the strings the app actually ships (locales/en/health_check.json), which differ
 * from the Figma copy quoted in the issue — see the note at the bottom of this file.
 */
import { test, expect } from "../fixtures/vortex-app";
import { navigateToHealthCheck, navigateToSettings } from "../helpers/navigation";
import { Timeouts } from "../helpers/timeouts";
import { freeUser, premiumUser } from "../helpers/users";
import { Header } from "../selectors/header";
import { HealthCheckPage, HealthCheckSettings } from "../selectors/healthCheck";
import { SettingsPage } from "../selectors/settings";

test.describe("Health Check", () => {
  // The page and settings behave identically for both tiers; run the tier-neutral
  // foundation as the free user and keep the tier-specific chrome in its own block.
  test.describe("free user", () => {
    test.use({ nexusUser: freeUser });

    test("[TC-03] empty loadout shows the passed state", async ({
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

    test("[TC-03] header shows the title, subtitle and controls", async ({
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

    test("[TC-04] refresh re-runs the check and shows 'Last updated'", async ({
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

    test("[TC-04] settings gear opens Settings at the Health Check section", async ({
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

    test("[TC-25] free user sees the premium banner", async ({
      vortexWindow,
      managedGame: _game,
    }) => {
      const hc = new HealthCheckPage(vortexWindow);

      await test.step("Open the Health Check page", async () => {
        await navigateToHealthCheck(vortexWindow);
        await expect(hc.title).toBeVisible();
      });

      await test.step("Premium banner is shown", async () => {
        await expect(hc.premiumBanner).toBeVisible();
      });
    });

    test("[TC-30] settings expose the mod- and file-requirement toggles", async ({
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

      // Visible only when the Unleash flag is present for this user — the E2E
      // accounts are enrolled, so it must render.
      await test.step("File-requirements toggle is shown", async () => {
        await expect(settings.fileRequirementsToggle).toBeVisible();
      });
    });

    test("[TC-30] file-requirements toggle flips and persists within the session", async ({
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

    test("[TC-26] premium user sees the premium indicator and no banner", async ({
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

/*
 * Copy discrepancies vs the Figma spec in the LAZ-684 comment (TC-35 — reported,
 * tests assert the shipped strings):
 *   - Page title: ships "Health Check" with a separate "Beta" pill (BetaBadge),
 *     not the inline "Health check (BETA)" of the Figma.
 *   - Subtitle: ships "Review your Loadout for any issues and learn how to resolve
 *     them if needed.", not "Find and fix issues in your loadout".
 *   - Settings description: ships "Detect issues with your mod list and suggest
 *     fixes. More checks are coming soon."
 *   - Toggle labels: ship "Missing mod requirements suggestions" / "Missing file
 *     requirements warnings", not the "Show missing mod ..." phrasing in TC-30.
 * Also note: the Active/Hidden tabs render only once at least one hideable item
 * exists, so the empty state has no "Active (0) / Hidden (0)" tabs (TC-03/TC-05).
 */
