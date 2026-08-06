/**
 * File Requirements Health Check — warning, detail, feedback + list-management
 * flows (LAZ-684).
 *
 * Fixture: SDV mod 49786 has a single main file declaring two file-level
 * requirements. Installed on its own (those required files absent) it raises one
 * file-requirements "download" warning covering both required mods (category
 * `download` / kind `missing`). The tests here cover:
 *   - the list warning (plural title / count / 1-click action)
 *   - the expanded detail view (Warning header, "Install required" group,
 *     requirement cards + buttons, section-level install-all)
 *   - progressive count: resolving one requirement decrements the summary
 *   - free user: list 1-click opens the multi-file Premium upsell
 *   - free user: a manual website download, and the "Install via mod page" link,
 *     resolve the warning
 *   - premium user: the list / header / detail 1-click installs resolve it
 *   - hide/unhide moves the warning between the Active and Hidden tabs
 *   - the warning's feedback controls (thumbs + FeedbackModal)
 *   - singular/plural copy (two requirements ⇒ the plural strings)
 *   - an OR requirement (SDV 47938, alternatives): the "pick one of these" warning,
 *     and (premium) picking one alternative satisfies the OR and clears it
 *
 * The warning is targeted by its title rather than the required mod's name, so
 * the spec doesn't hard-code the fixture's requirement target. SMAPI is
 * deliberately avoided here — Vortex special-cases it with a dedicated installer,
 * which interferes with a clean warning/install flow.
 *
 * The shared "install the fixture mod → open Health Check → surface the warning"
 * setup lives in helpers/healthCheck.ts (openFileRequirementWarning); each test
 * starts from there.
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
import {
  SDV_FILE_REQUIREMENT_TARGET_URL_PATTERN,
  SDV_FILE_REQUIREMENT_TARGET_URLS,
} from "../constants";
import { test, expect } from "../fixtures/vortex-app";
import { installExternalOpenSpy, readExternalOpens } from "../helpers/externalOpen";
import {
  openFileRequirementWarning,
  openOrFileRequirementWarning,
  openWarningDetail,
} from "../helpers/healthCheck";
import { downloadModViaModManager } from "../helpers/modDownload";
import { dismissAllNotifications } from "../helpers/notifications";
import { Timeouts } from "../helpers/timeouts";
import { freeUser, premiumUser } from "../helpers/users";
import { HealthCheckFeedbackModal, HealthCheckPremiumModal } from "../selectors/healthCheck";

test.describe("Health Check - file requirement warnings", () => {
  test.describe("free user", () => {
    test.use({ nexusUser: freeUser });

    test("Check the warning and detail render, and 1-click shows the Premium upsell", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { hc, warnings } = await openFileRequirementWarning(nexusPage, vortexApp, vortexWindow);

      await test.step("The warning uses the plural title (two requirements)", async () => {
        await expect(warnings.title()).toHaveText(/Missing required mods for:/);
      });

      await test.step("The list 1-click action is counted (2)", async () => {
        await expect(warnings.installOneClick()).toHaveAccessibleName(/1-click install \(2\)/);
      });

      const detail = await openWarningDetail(vortexWindow, warnings);

      await test.step("Detail states the plural file-requirement summary", async () => {
        await expect(detail.requiresFileSummary(2)).toBeVisible();
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

    test("Check that health check items can be moved between the Active and Hidden tabs", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { hc, warnings } = await openFileRequirementWarning(nexusPage, vortexApp, vortexWindow);

      await test.step("The warning starts on the Active tab", async () => {
        // Track the file-requirement warning by its own row, not the tab's aggregate
        // "(N)" count: a page-level mod-requirement "suggestion" can also be active
        // (see LAZ-852), which would inflate that count. warnings.row() is scoped to
        // the file-warning title, so it stays correct regardless of what else is listed.
        await expect(warnings.row()).toBeVisible();
      });

      await test.step("Hidden tab starts empty", async () => {
        // Only the file warning is ever hidden here, so the Hidden count is safe.
        await expect(hc.hiddenTab).toContainText("(0)");
      });

      await test.step("Reveal the warning's row actions on hover", async () => {
        await dismissAllNotifications(vortexWindow);
        await warnings.title().hover();
        await expect(warnings.hideButton()).toBeVisible();
      });

      await test.step("Hide the warning via its row control", async () => {
        await warnings.hideButton().click();
        await expect(hc.hiddenTab).toContainText("(1)");
      });

      await test.step("The warning has left the Active tab", async () => {
        await expect(warnings.row()).toHaveCount(0);
      });

      await test.step("The Hidden tab lists the warning", async () => {
        await hc.hiddenTab.click();
        await expect(warnings.row()).toBeVisible();
      });

      await test.step("Reveal the hidden warning's row actions on hover", async () => {
        await dismissAllNotifications(vortexWindow);
        await warnings.title().hover();
        await expect(warnings.unhideButton()).toBeVisible();
      });

      await test.step("Unhide the warning via its row control", async () => {
        await warnings.unhideButton().click();
        await expect(hc.hiddenTab).toContainText("(0)");
      });

      await test.step("The warning is back on the Active tab", async () => {
        await hc.activeTab.click();
        await expect(warnings.row()).toBeVisible();
      });
    });

    test("Check that the feedback controls are present and operational", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { warnings } = await openFileRequirementWarning(nexusPage, vortexApp, vortexWindow);
      const feedback = new HealthCheckFeedbackModal(vortexWindow);

      await test.step("Hovering the warning reveals its feedback controls", async () => {
        await warnings.title().hover();
        await expect(warnings.notHelpfulButton()).toBeVisible();
      });

      const detail = await openWarningDetail(vortexWindow, warnings);

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

      await test.step("Select a feedback reason", async () => {
        await feedback.incorrectRequirement.click();
        await expect(feedback.sendButton).toBeEnabled();
      });

      await test.step("Sending the feedback records it", async () => {
        await feedback.sendButton.click();
        await expect(detail.feedbackThanks).toBeVisible();
      });
    });

    test("Check that a manual website download resolves the warning for a free user", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { hc, warnings } = await openFileRequirementWarning(nexusPage, vortexApp, vortexWindow);

      for (const [index, url] of SDV_FILE_REQUIREMENT_TARGET_URLS.entries()) {
        const isLast = index === SDV_FILE_REQUIREMENT_TARGET_URLS.length - 1;

        await test.step(`Manually download required mod ${index + 1} and refresh`, async () => {
          await downloadModViaModManager(nexusPage, vortexApp, url);
          await hc.refreshButton.click();
          // The warning covers every requirement, so it only clears once the last
          // one is satisfied; earlier downloads leave it on the list.
          await expect(warnings.row()).toHaveCount(isLast ? 0 : 1, { timeout: Timeouts.LIFECYCLE });
        });
      }
    });

    test("Check the 'Install via mod page' link opens the required mod and its download resolves the requirement", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { warnings } = await openFileRequirementWarning(nexusPage, vortexApp, vortexWindow);
      const detail = await openWarningDetail(vortexWindow, warnings);

      await test.step("The detail starts with two outstanding requirements", async () => {
        await expect(detail.requiresFileSummary(2)).toBeVisible();
      });

      let modPageUrl = "";

      await test.step("Arm the external-open spy", async () => {
        // The link opens the OS browser via shell.openExternal, which Playwright
        // can't follow — spy on the main process to capture (and suppress) the URL.
        await installExternalOpenSpy(vortexApp);
        expect(await readExternalOpens(vortexApp)).toEqual([]);
      });

      await test.step("'Install via mod page' targets the required mod's Nexus page", async () => {
        await dismissAllNotifications(vortexWindow);
        await detail.installViaModPageButton.click();
        const opened = await readExternalOpens(vortexApp);
        modPageUrl = opened.find((url) => SDV_FILE_REQUIREMENT_TARGET_URL_PATTERN.test(url)) ?? "";
        expect(modPageUrl, `opened URLs: ${opened.join(", ")}`).toMatch(
          SDV_FILE_REQUIREMENT_TARGET_URL_PATTERN,
        );
      });

      await test.step("Downloading from that page resolves the requirement (count 2 → 1)", async () => {
        await downloadModViaModManager(nexusPage, vortexApp, modPageUrl);
        await expect(detail.requiresFileSummary(1)).toBeVisible({ timeout: Timeouts.LIFECYCLE });
      });
    });

    test("Check an OR file requirement surfaces as a warning that asks the user to pick one of several options", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { warnings } = await openOrFileRequirementWarning(nexusPage, vortexApp, vortexWindow);

      await test.step("The OR requirement surfaces as a file-requirements warning", async () => {
        await expect(warnings.title()).toBeVisible();
      });

      await test.step("The list row offers 'Pick mod install' rather than a direct 1-click install", async () => {
        await expect(warnings.pickModInstall()).toBeVisible();
      });

      const detail = await openWarningDetail(vortexWindow, warnings);

      await test.step("Detail states the requirement must be picked (not just installed)", async () => {
        await expect(detail.requiresPickLine).toBeVisible();
      });

      await test.step("Detail groups the alternatives under 'Pick one of these'", async () => {
        await expect(detail.pickOneHeader).toBeVisible();
      });

      await test.step("Detail separates the alternatives with an 'Or' divider (a choice of options)", async () => {
        await expect(detail.orDivider).toBeVisible();
      });
    });
  });

  test.describe("premium user", () => {
    test.use({ nexusUser: premiumUser });

    test("Check the warning-row 1-click install button resolves all requirements", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { hc, warnings } = await openFileRequirementWarning(nexusPage, vortexApp, vortexWindow);

      await test.step("The warning uses the plural title (two requirements)", async () => {
        await expect(warnings.title()).toHaveText(/Missing required mods for:/);
      });

      const detail = await openWarningDetail(vortexWindow, warnings);

      await test.step("Detail states the plural file-requirement summary", async () => {
        await expect(detail.requiresFileSummary(2)).toBeVisible();
      });

      await test.step("Detail offers a section-level install-all for the two requirements", async () => {
        await expect(detail.installAllInGroupButton).toBeVisible();
      });

      await test.step("Return to the list", async () => {
        await detail.backButton.click();
        await expect(hc.title).toBeVisible();
      });

      await test.step("1-click install downloads and installs the required mods, clearing the warning", async () => {
        await warnings.installOneClick().click();
        await expect(warnings.row()).toHaveCount(0, { timeout: Timeouts.LIFECYCLE });
      });
    });

    test("Check the header 1-click install button resolves all requirements on the health check", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { hc, warnings } = await openFileRequirementWarning(nexusPage, vortexApp, vortexWindow);

      await test.step("The header 1-click install all installs the requirements, clearing the warning", async () => {
        await dismissAllNotifications(vortexWindow);
        await hc.installAllButton.click();
        await expect(warnings.row()).toHaveCount(0, { timeout: Timeouts.LIFECYCLE });
      });
    });

    test("Check the detail 'install all' button resolves all requirements", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { warnings } = await openFileRequirementWarning(nexusPage, vortexApp, vortexWindow);
      const detail = await openWarningDetail(vortexWindow, warnings);

      await test.step("Trigger the detail's 1-click install all", async () => {
        await dismissAllNotifications(vortexWindow);
        await detail.installAllInGroupButton.click();
        // The requirement group unmounts once every candidate installs.
        await expect(detail.installAllInGroupButton).toBeHidden({ timeout: Timeouts.LIFECYCLE });
      });

      await test.step("Returning to the list shows the warning cleared", async () => {
        await detail.backButton.click();
        await expect(warnings.row()).toHaveCount(0);
      });
    });

    test("Check the per-requirement 1-click install resolves one requirement and decrements the count", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { warnings } = await openFileRequirementWarning(nexusPage, vortexApp, vortexWindow);
      const detail = await openWarningDetail(vortexWindow, warnings);

      await test.step("The detail starts with two outstanding requirements", async () => {
        await expect(detail.requiresFileSummary(2)).toBeVisible();
      });

      await test.step("Installing one requirement (per-card) decrements the count to one", async () => {
        await dismissAllNotifications(vortexWindow);
        await detail.installOneClickButton.click();
        await expect(detail.requiresFileSummary(1)).toBeVisible({ timeout: Timeouts.LIFECYCLE });
      });
    });

    test("Check picking one alternative of an OR requirement resolves it", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { warnings } = await openOrFileRequirementWarning(nexusPage, vortexApp, vortexWindow);
      const detail = await openWarningDetail(vortexWindow, warnings);

      await test.step("The detail offers a choice of alternatives to pick", async () => {
        await expect(detail.pickOneHeader).toBeVisible();
      });

      await test.step("Pick one alternative to install", async () => {
        await dismissAllNotifications(vortexWindow);
        await detail.installOneClickButton.click();
        // Satisfying any one alternative resolves the OR, so its group unmounts.
        await expect(detail.pickOneHeader).toBeHidden({ timeout: Timeouts.LIFECYCLE });
      });

      await test.step("Returning to the list shows the OR resolved", async () => {
        await detail.backButton.click();
        await expect(warnings.row()).toHaveCount(0);
      });
    });
  });
});
