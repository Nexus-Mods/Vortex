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
import { SDV_FILE_REQUIREMENT_TARGET_URLS } from "../constants";
import { test, expect } from "../fixtures/vortex-app";
import { installExternalOpenSpy, readExternalOpens } from "../helpers/externalOpen";
import { openFileRequirementWarning, openWarningDetail } from "../helpers/healthCheck";
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
        await expect(warnings.row().getByText("Missing required mods for:")).toBeVisible();
      });

      await test.step("The list 1-click action is counted (2)", async () => {
        await expect(
          warnings.row().getByRole("button", { name: /1-click install \(2\)/ }),
        ).toBeVisible();
      });

      const detail = await openWarningDetail(vortexWindow, warnings);

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

    test("Check that health check items can be moved between the Active and Hidden tabs", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { hc, warnings } = await openFileRequirementWarning(nexusPage, vortexApp, vortexWindow);

      await test.step("Active tab shows one warning", async () => {
        await expect(hc.activeTab).toContainText("(1)");
      });

      await test.step("Hidden tab starts empty", async () => {
        await expect(hc.hiddenTab).toContainText("(0)");
      });

      await test.step("Hide the warning via its row control", async () => {
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

    test("Check that the feedback controls are present and operational", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { warnings } = await openFileRequirementWarning(nexusPage, vortexApp, vortexWindow);
      const feedback = new HealthCheckFeedbackModal(vortexWindow);

      await test.step("Hovering the warning reveals its feedback controls", async () => {
        await warnings
          .row()
          .getByText(/Missing required mods? for:/)
          .hover();
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

      await test.step("Sending feedback records it", async () => {
        await feedback.incorrectRequirement.click();
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

      await test.step("Manually download each required mod from the website", async () => {
        // A free user can't 1-click install (that opens the Premium upsell) instead;
        // they download the required files from the mod pages. Drive that same
        // Mod-Manager website download and forward it to Vortex, which installs it.
        for (const url of SDV_FILE_REQUIREMENT_TARGET_URLS) {
          await downloadModViaModManager(nexusPage, vortexApp, url);
        }
      });

      await test.step("The ingested downloads clear the warning", async () => {
        await hc.refreshButton.click();
        await expect(warnings.row()).toHaveCount(0, { timeout: Timeouts.LIFECYCLE });
      });
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
        await expect(
          detail.root.getByText(
            "Requires 2 additional mod files to be installed to work correctly",
          ),
        ).toBeVisible();
      });

      let modPageUrl = "";

      await test.step("'Install via mod page' targets the required mod's Nexus page", async () => {
        // The link opens the OS browser via shell.openExternal, which Playwright
        // can't follow — spy on the main process to capture (and suppress) the URL.
        await installExternalOpenSpy(vortexApp);
        await dismissAllNotifications(vortexWindow);
        await detail.installViaModPageButton.click();
        const opened = await readExternalOpens(vortexApp);
        modPageUrl =
          opened.find((url) => /nexusmods\.com\/stardewvalley\/mods\/(5382|49098)$/.test(url)) ??
          "";
        expect(modPageUrl, `opened URLs: ${opened.join(", ")}`).toMatch(
          /nexusmods\.com\/stardewvalley\/mods\/(5382|49098)$/,
        );
      });

      await test.step("Downloading from that page resolves the requirement (count 2 → 1)", async () => {
        // Complete the journey the link starts: download the required mod from that
        // same page and forward it to Vortex; the summary then decrements to singular.
        await downloadModViaModManager(nexusPage, vortexApp, modPageUrl);
        await expect(
          detail.root.getByText("Requires 1 additional mod file to be installed to work correctly"),
        ).toBeVisible({ timeout: Timeouts.LIFECYCLE });
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
        await expect(warnings.row().getByText("Missing required mods for:")).toBeVisible();
      });

      const detail = await openWarningDetail(vortexWindow, warnings);

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

      await test.step("The detail 1-click install all installs the requirements, clearing the warning", async () => {
        await dismissAllNotifications(vortexWindow);
        await detail.installAllInGroupButton.click();
        await detail.backButton.click();
        await expect(warnings.row()).toHaveCount(0, { timeout: Timeouts.LIFECYCLE });
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
        await expect(
          detail.root.getByText(
            "Requires 2 additional mod files to be installed to work correctly",
          ),
        ).toBeVisible();
      });

      await test.step("Installing one requirement (per-card) decrements the count to one", async () => {
        // The per-card "1-click install" resolves a single requirement; as it
        // installs, that card drops out and the summary decrements to the singular
        // copy (Figma: "remove the mod requirement item ... update counts").
        await dismissAllNotifications(vortexWindow);
        await detail.installOneClickButton.click();
        await expect(
          detail.root.getByText("Requires 1 additional mod file to be installed to work correctly"),
        ).toBeVisible({ timeout: Timeouts.LIFECYCLE });
      });
    });
  });
});
