/**
 * File Requirements Health Check — warning + install flow (LAZ-684).
 *
 * Fixture: SDV mod 49786 has a single main file declaring two file-level
 * requirements. Installed on its own (those required files absent) it raises one
 * file-requirements "download" warning covering both required mods, which drives:
 *   - TC-01  list warning renders (title / count / 1-click action)
 *   - TC-07  expanded detail view (Warning header, requirement cards, buttons)
 *   - TC-24  free user: list 1-click opens the Premium upsell
 *   - TC-26  premium user: 1-click install downloads + installs the required mods,
 *            clearing the warning
 *
 * The warning is targeted by its title rather than the required mod's name, so
 * the spec doesn't hard-code the fixture's requirement target. SMAPI is
 * deliberately avoided here — Vortex special-cases it with a dedicated installer,
 * which interferes with a clean warning/install flow.
 *
 * These are heavy (real Mod-Manager download + install) and, like every
 * authenticated / managed-game spec, currently need CI to run — locally the OAuth
 * login is captcha-blocked and manageGame can't locate the game row. Kept in their
 * own file so the fast foundation suite (health-check.spec.ts) isn't slowed.
 *
 * Assumption: 49786's requirements are file-level only, not page-level "requires"
 * rules. Enabling a mod silently auto-installs its page-level dependencies
 * (mod_management/index.ts "mod-enabled" handler); a page-level rule would
 * auto-install and no warning would surface. If these tests fail at the first
 * warnings.row() assertion, re-confirm the fixture is file-level only (or pick
 * another source mod).
 */
import { SDV_FILE_REQUIREMENT_MOD_URL } from "../constants";
import { test, expect } from "../fixtures/vortex-app";
import { downloadModViaModManager } from "../helpers/modDownload";
import { navigateToHealthCheck } from "../helpers/navigation";
import { Timeouts } from "../helpers/timeouts";
import { freeUser, premiumUser } from "../helpers/users";
import { HealthCheckDetail, HealthCheckPage, HealthCheckWarnings } from "../selectors/healthCheck";

test.describe("Health Check - file requirement warning", () => {
  test.describe("free user", () => {
    test.use({ nexusUser: freeUser });

    test("[TC-01/07/24] warning renders, detail lists the requirement, 1-click upsells", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const hc = new HealthCheckPage(vortexWindow);
      const warnings = new HealthCheckWarnings(vortexWindow);

      await test.step("Install the requiring mod with its required file absent", async () => {
        await downloadModViaModManager(nexusPage, vortexApp, SDV_FILE_REQUIREMENT_MOD_URL);
      });

      await test.step("Open Health Check and refresh", async () => {
        await navigateToHealthCheck(vortexWindow);
        await hc.refreshButton.click();
        await expect(warnings.row()).toBeVisible({ timeout: Timeouts.NETWORK });
      });

      await test.step("Warning row offers a 1-click install action", async () => {
        await expect(warnings.installOneClick()).toBeVisible();
      });

      await test.step("Open the warning detail view", async () => {
        await warnings
          .row()
          .getByText(/Missing required mods? for:/)
          .click();
        await expect(new HealthCheckDetail(vortexWindow).warningTitle).toBeVisible();
      });

      const detail = new HealthCheckDetail(vortexWindow);

      await test.step("Detail states the file requirement(s)", async () => {
        await expect(detail.requiresFileLine).toBeVisible();
      });

      await test.step("Detail offers the Install via mod page fallback", async () => {
        await expect(detail.installViaModPageButton).toBeVisible();
      });

      await test.step("Return to the list", async () => {
        await detail.backButton.click();
        await expect(hc.title).toBeVisible();
      });

      await test.step("List 1-click opens the Premium upsell", async () => {
        await warnings.installOneClick().click();
        await expect(vortexWindow.getByText(/Skip the website and install/)).toBeVisible();
      });
    });
  });

  test.describe("premium user", () => {
    test.use({ nexusUser: premiumUser });

    test("[TC-01/26] 1-click install resolves the file requirement", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const hc = new HealthCheckPage(vortexWindow);
      const warnings = new HealthCheckWarnings(vortexWindow);

      await test.step("Install the requiring mod with its required file absent", async () => {
        await downloadModViaModManager(nexusPage, vortexApp, SDV_FILE_REQUIREMENT_MOD_URL);
      });

      await test.step("Open Health Check and refresh", async () => {
        await navigateToHealthCheck(vortexWindow);
        await hc.refreshButton.click();
        await expect(warnings.row()).toBeVisible({ timeout: Timeouts.NETWORK });
      });

      await test.step("Open the warning detail view", async () => {
        await warnings
          .row()
          .getByText(/Missing required mods? for:/)
          .click();
        await expect(new HealthCheckDetail(vortexWindow).warningTitle).toBeVisible();
      });

      const detail = new HealthCheckDetail(vortexWindow);

      await test.step("Detail states the file requirement(s)", async () => {
        await expect(detail.requiresFileLine).toBeVisible();
      });

      await test.step("Return to the list", async () => {
        await detail.backButton.click();
        await expect(hc.title).toBeVisible();
      });

      await test.step("1-click install downloads and installs the required mod(s), clearing the warning", async () => {
        // For a premium user the list-row 1-click installs every candidate in the
        // report (both required mods here). Spans real downloads + installs +
        // deploy + a fresh file-requirements re-run, so use the cold-start budget.
        await warnings.installOneClick().click();
        await expect(warnings.row()).toHaveCount(0, { timeout: Timeouts.LIFECYCLE });
      });
    });
  });
});
