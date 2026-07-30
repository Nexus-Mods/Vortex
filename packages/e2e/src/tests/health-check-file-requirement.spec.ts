/**
 * File Requirements Health Check — warning, detail, feedback + list-management
 * flows (LAZ-684).
 *
 * Fixture: SDV mod 49786 has a single main file declaring two file-level
 * requirements. Installed on its own (those required files absent) it raises one
 * file-requirements "download" warning covering both required mods (category
 * `download` / kind `missing`), which drives:
 *   - TC-01  list warning renders (plural title / count / 1-click action)
 *   - TC-07  expanded detail view (Warning header, "Install required" group,
 *            requirement cards + buttons, section-level install-all)
 *   - TC-24  free user: list 1-click opens the multi-file Premium upsell
 *   - TC-26  premium user: 1-click install downloads + installs the required mods
 *   - TC-05  hide/unhide moves the warning between the Active and Hidden tabs
 *   - TC-29  the warning's feedback controls (thumbs + FeedbackModal)
 *   - TC-35  singular/plural copy (two requirements ⇒ the plural strings)
 *
 * The warning is targeted by its title rather than the required mod's name, so
 * the spec doesn't hard-code the fixture's requirement target. SMAPI is
 * deliberately avoided here — Vortex special-cases it with a dedicated installer,
 * which interferes with a clean warning/install flow.
 *
 * These are heavy (real Mod-Manager download + install) and, like every
 * authenticated / managed-game spec, currently need CI to run — locally the OAuth
 * login is captcha-blocked (mitigated by a captured auth snapshot; see
 * helpers/authState.ts). Kept in their own file so the fast foundation suite
 * (health-check.spec.ts) isn't slowed.
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
import { dismissAllNotifications } from "../helpers/notifications";
import { Timeouts } from "../helpers/timeouts";
import { freeUser, premiumUser } from "../helpers/users";
import {
  HealthCheckDetail,
  HealthCheckFeedbackModal,
  HealthCheckPage,
  HealthCheckPremiumModal,
  HealthCheckWarnings,
} from "../selectors/healthCheck";

test.describe("Health Check - file requirement warning", () => {
  test.describe("free user", () => {
    test.use({ nexusUser: freeUser });

    test("[TC-01/07/24/35] warning renders, detail lists the requirements, 1-click upsells", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const hc = new HealthCheckPage(vortexWindow);
      const warnings = new HealthCheckWarnings(vortexWindow);

      await test.step("Install the requiring mod with its required files absent", async () => {
        await downloadModViaModManager(nexusPage, vortexApp, SDV_FILE_REQUIREMENT_MOD_URL);
      });

      await test.step("Open Health Check and refresh", async () => {
        await navigateToHealthCheck(vortexWindow);
        await hc.refreshButton.click();
        await expect(warnings.row()).toBeVisible({ timeout: Timeouts.NETWORK });
        // A refresh can spawn notifications, which auto-open a popover that overlays
        // the top-right and intercepts clicks on the tabs' buttons and a row's
        // hide/feedback icons. Clear it once the check has settled so it stays shut.
        await dismissAllNotifications(vortexWindow);
      });

      await test.step("The warning uses the plural title (two requirements)", async () => {
        await expect(warnings.row().getByText("Missing required mods for:")).toBeVisible();
      });

      await test.step("The list 1-click action is counted (2)", async () => {
        await expect(
          warnings.row().getByRole("button", { name: /1-click install \(2\)/ }),
        ).toBeVisible();
      });

      await test.step("Open the warning detail view", async () => {
        await warnings
          .row()
          .getByText(/Missing required mods? for:/)
          .click();
        await expect(new HealthCheckDetail(vortexWindow).warningTitle).toBeVisible();
      });

      const detail = new HealthCheckDetail(vortexWindow);

      await test.step("Detail states the plural file-requirement summary", async () => {
        await expect(
          detail.root.getByText(
            "Requires 2 additional mod files to be installed to work correctly",
          ),
        ).toBeVisible();
      });

      await test.step("Detail groups the requirements under 'Install required'", async () => {
        await expect(detail.installRequiredHeader).toBeVisible();
      });

      await test.step("Detail offers the Install via mod page fallback", async () => {
        await expect(detail.installViaModPageButton).toBeVisible();
      });

      await test.step("Detail offers a section-level install-all for the two requirements", async () => {
        await expect(detail.installAllInGroupButton).toBeVisible();
      });

      await test.step("Return to the list", async () => {
        await detail.backButton.click();
        await expect(hc.title).toBeVisible();
      });

      const premiumModal = new HealthCheckPremiumModal(vortexWindow);

      await test.step("List 1-click opens the multi-file Premium upsell", async () => {
        await warnings.installOneClick().click();
        await expect(premiumModal.allTitle).toBeVisible();
      });

      await test.step("Upsell lists the Premium benefits", async () => {
        await expect(premiumModal.benefitsTitle).toBeVisible();
      });

      await test.step("Upsell offers the Unlock action", async () => {
        await expect(premiumModal.unlockButton).toBeVisible();
      });
    });

    test("[TC-05] hiding a warning moves it between the Active and Hidden tabs", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const hc = new HealthCheckPage(vortexWindow);
      const warnings = new HealthCheckWarnings(vortexWindow);

      await test.step("Install the requiring mod with its required files absent", async () => {
        await downloadModViaModManager(nexusPage, vortexApp, SDV_FILE_REQUIREMENT_MOD_URL);
      });

      await test.step("Open Health Check and refresh", async () => {
        await navigateToHealthCheck(vortexWindow);
        await hc.refreshButton.click();
        await expect(warnings.row()).toBeVisible({ timeout: Timeouts.NETWORK });
        // A refresh can spawn notifications, which auto-open a popover that overlays
        // the top-right and intercepts clicks on the tabs' buttons and a row's
        // hide/feedback icons. Clear it once the check has settled so it stays shut.
        await dismissAllNotifications(vortexWindow);
      });

      await test.step("Active tab shows one warning", async () => {
        await expect(hc.activeTab).toContainText("(1)");
      });

      await test.step("Hidden tab starts empty", async () => {
        await expect(hc.hiddenTab).toContainText("(0)");
      });

      await test.step("Hide the warning via its row control", async () => {
        // Clear any (re-)surfaced notification tray that would overlay the row's
        // right-aligned hide icon, then reveal the icon by hovering the title text
        // (left-aligned) rather than the row centre, which the action bar overlaps.
        await dismissAllNotifications(vortexWindow);
        await warnings
          .row()
          .getByText(/Missing required mods? for:/)
          .hover();
        await warnings.hideButton().click();
        await expect(hc.hiddenTab).toContainText("(1)");
      });

      await test.step("The Active tab is now empty", async () => {
        await expect(hc.activeTab).toContainText("(0)");
      });

      await test.step("The Hidden tab lists the warning", async () => {
        await hc.hiddenTab.click();
        await expect(warnings.row()).toBeVisible();
      });

      await test.step("Unhide the warning via its row control", async () => {
        await dismissAllNotifications(vortexWindow);
        await warnings
          .row()
          .getByText(/Missing required mods? for:/)
          .hover();
        await warnings.unhideButton().click();
        await expect(hc.hiddenTab).toContainText("(0)");
      });

      await test.step("The warning is back on the Active tab", async () => {
        await hc.activeTab.click();
        await expect(warnings.row()).toBeVisible();
      });
    });

    test("[TC-29] the warning exposes feedback controls and records feedback", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const hc = new HealthCheckPage(vortexWindow);
      const warnings = new HealthCheckWarnings(vortexWindow);
      const detail = new HealthCheckDetail(vortexWindow);
      const feedback = new HealthCheckFeedbackModal(vortexWindow);

      await test.step("Install the requiring mod with its required files absent", async () => {
        await downloadModViaModManager(nexusPage, vortexApp, SDV_FILE_REQUIREMENT_MOD_URL);
      });

      await test.step("Open Health Check and refresh", async () => {
        await navigateToHealthCheck(vortexWindow);
        await hc.refreshButton.click();
        await expect(warnings.row()).toBeVisible({ timeout: Timeouts.NETWORK });
        // A refresh can spawn notifications, which auto-open a popover that overlays
        // the top-right and intercepts clicks on the tabs' buttons and a row's
        // hide/feedback icons. Clear it once the check has settled so it stays shut.
        await dismissAllNotifications(vortexWindow);
      });

      await test.step("Hovering the warning reveals its feedback controls", async () => {
        // The row's EntryActions are invisible until hover; target the title text
        // (left-aligned) rather than the row centre, which the action bar overlaps.
        await warnings
          .row()
          .getByText(/Missing required mods? for:/)
          .hover();
        await expect(warnings.notHelpfulButton()).toBeVisible();
      });

      await test.step("Open the warning detail view", async () => {
        await warnings
          .row()
          .getByText(/Missing required mods? for:/)
          .click();
        await expect(detail.warningTitle).toBeVisible();
      });

      await test.step("Detail shows the 'Was this warning helpful?' prompt", async () => {
        await expect(detail.feedbackPrompt).toBeVisible();
      });

      await test.step("Thumbs-down opens the feedback modal", async () => {
        await detail.notHelpfulButton.click();
        await expect(feedback.title).toBeVisible();
      });

      await test.step("The feedback modal offers a Send action", async () => {
        await expect(feedback.sendButton).toBeVisible();
      });

      await test.step("Sending feedback records it", async () => {
        await feedback.incorrectRequirement.click();
        await feedback.sendButton.click();
        await expect(detail.feedbackThanks).toBeVisible();
      });
    });
  });

  test.describe("premium user", () => {
    test.use({ nexusUser: premiumUser });

    test("[TC-01/26/35] 1-click install resolves the file requirements", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const hc = new HealthCheckPage(vortexWindow);
      const warnings = new HealthCheckWarnings(vortexWindow);

      await test.step("Install the requiring mod with its required files absent", async () => {
        await downloadModViaModManager(nexusPage, vortexApp, SDV_FILE_REQUIREMENT_MOD_URL);
      });

      await test.step("Open Health Check and refresh", async () => {
        await navigateToHealthCheck(vortexWindow);
        await hc.refreshButton.click();
        await expect(warnings.row()).toBeVisible({ timeout: Timeouts.NETWORK });
        // A refresh can spawn notifications, which auto-open a popover that overlays
        // the top-right and intercepts clicks on the tabs' buttons and a row's
        // hide/feedback icons. Clear it once the check has settled so it stays shut.
        await dismissAllNotifications(vortexWindow);
      });

      await test.step("The warning uses the plural title (two requirements)", async () => {
        await expect(warnings.row().getByText("Missing required mods for:")).toBeVisible();
      });

      await test.step("Open the warning detail view", async () => {
        await warnings
          .row()
          .getByText(/Missing required mods? for:/)
          .click();
        await expect(new HealthCheckDetail(vortexWindow).warningTitle).toBeVisible();
      });

      const detail = new HealthCheckDetail(vortexWindow);

      await test.step("Detail states the plural file-requirement summary", async () => {
        await expect(
          detail.root.getByText(
            "Requires 2 additional mod files to be installed to work correctly",
          ),
        ).toBeVisible();
      });

      await test.step("Detail offers a section-level install-all for the two requirements", async () => {
        await expect(detail.installAllInGroupButton).toBeVisible();
      });

      await test.step("Return to the list", async () => {
        await detail.backButton.click();
        await expect(hc.title).toBeVisible();
      });

      await test.step("1-click install downloads and installs the required mods, clearing the warning", async () => {
        // For a premium user the list-row 1-click installs every candidate in the
        // report (both required mods here). Spans real downloads + installs +
        // deploy + a fresh file-requirements re-run, so use the cold-start budget.
        await warnings.installOneClick().click();
        await expect(warnings.row()).toHaveCount(0, { timeout: Timeouts.LIFECYCLE });
      });
    });
  });
});
