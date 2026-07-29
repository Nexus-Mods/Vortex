/**
 * File Requirements Health Check — warning + install flow (LAZ-684).
 *
 * Fixture: SDV mod 1915 declares a file-level requirement on SMAPI (mods/2400).
 * Installed on its own (SMAPI absent) it raises a single-file "download" warning,
 * which drives:
 *   - TC-01  list warning renders (title / count / required-mod name / 1-click action)
 *   - TC-07  expanded detail view (Warning header, requirement card, buttons)
 *   - TC-24  free user: list 1-click opens the single-file Premium upsell
 *   - TC-26  premium user: 1-click install downloads + installs SMAPI, clearing the warning
 *
 * These are heavy (real Mod-Manager download + install) and, like every
 * authenticated / managed-game spec, currently need CI to run — locally the OAuth
 * login is captcha-blocked and manageGame can't locate the game row. Kept in their
 * own file so the fast foundation suite (health-check.spec.ts) isn't slowed.
 *
 * Assumption: 1915 declares SMAPI as a FILE-level requirement only, not a
 * page-level "requires" rule. Enabling a mod silently auto-installs its
 * page-level dependencies (mod_management/index.ts "mod-enabled" handler); if
 * 1915 carried a page-level SMAPI rule, SMAPI would auto-install and no warning
 * would surface. If these tests ever fail at the first warnings.row assertion,
 * re-confirm the fixture is file-level only (or pick another source mod).
 */
import { SDV_FILE_REQUIREMENT_MOD_URL } from "../constants";
import { test, expect } from "../fixtures/vortex-app";
import { downloadModViaModManager } from "../helpers/modDownload";
import { SMAPI_NAME } from "../helpers/mods";
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

      await test.step("Install the requiring mod with SMAPI absent", async () => {
        await downloadModViaModManager(nexusPage, vortexApp, SDV_FILE_REQUIREMENT_MOD_URL);
      });

      await test.step("Open Health Check and refresh", async () => {
        await navigateToHealthCheck(vortexWindow);
        await hc.refreshButton.click();
        await expect(warnings.row(SMAPI_NAME)).toBeVisible({ timeout: Timeouts.NETWORK });
      });

      await test.step("Warning row offers a 1-click install action", async () => {
        await expect(warnings.installOneClick(SMAPI_NAME)).toBeVisible();
      });

      await test.step("Open the warning detail view", async () => {
        await warnings
          .row(SMAPI_NAME)
          .getByText(/Missing required mod for:/)
          .click();
        await expect(new HealthCheckDetail(vortexWindow).warningTitle).toBeVisible();
      });

      const detail = new HealthCheckDetail(vortexWindow);

      await test.step("Detail states the single-file requirement", async () => {
        await expect(detail.requiresFileLine).toBeVisible();
      });

      await test.step("Detail names the required mod (SMAPI)", async () => {
        await expect(detail.requirementCard(SMAPI_NAME)).toBeVisible();
      });

      await test.step("Detail offers the Install via mod page fallback", async () => {
        await expect(detail.installViaModPageButton).toBeVisible();
      });

      await test.step("Return to the list", async () => {
        await detail.backButton.click();
        await expect(hc.title).toBeVisible();
      });

      await test.step("List 1-click opens the single-file Premium upsell", async () => {
        await warnings.installOneClick(SMAPI_NAME).click();
        await expect(
          vortexWindow.getByText("Skip the website and install instantly."),
        ).toBeVisible();
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

      await test.step("Install the requiring mod with SMAPI absent", async () => {
        await downloadModViaModManager(nexusPage, vortexApp, SDV_FILE_REQUIREMENT_MOD_URL);
      });

      await test.step("Open Health Check and refresh", async () => {
        await navigateToHealthCheck(vortexWindow);
        await hc.refreshButton.click();
        await expect(warnings.row(SMAPI_NAME)).toBeVisible({ timeout: Timeouts.NETWORK });
      });

      await test.step("Open the warning detail view", async () => {
        await warnings
          .row(SMAPI_NAME)
          .getByText(/Missing required mod for:/)
          .click();
        await expect(new HealthCheckDetail(vortexWindow).warningTitle).toBeVisible();
      });

      const detail = new HealthCheckDetail(vortexWindow);

      await test.step("Detail offers a 1-click install", async () => {
        await expect(detail.installOneClickButton).toBeVisible();
      });

      await test.step("1-click install downloads and installs SMAPI, returning to the list", async () => {
        await detail.installOneClickButton.click();
        // On success the requirement clears and the detail auto-returns to the
        // list (HealthCheckDetailPage's live-entry effect). This spans a real
        // download + install + deploy + a fresh file-requirements re-run, so use
        // the cold-start budget rather than a single network round-trip.
        await expect(hc.title).toBeVisible({ timeout: Timeouts.LIFECYCLE });
      });

      await test.step("The SMAPI warning is gone", async () => {
        await expect(warnings.row(SMAPI_NAME)).toHaveCount(0);
      });
    });
  });
});
