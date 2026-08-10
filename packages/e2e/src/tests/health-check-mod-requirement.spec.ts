/**
 * Mod Requirements Health Check — page-level requirement "suggestions" (LAZ-684).
 *
 * Fixture: SDV mod 46415 declares a single page-level (mod-to-mod) requirement.
 * Installed on its own (that required mod absent) it raises one blue Suggestion
 * ("Additional mod file may be required for: …") — the mod-to-mod counterpart of
 * the file-requirement warnings in health-check-file-requirement.spec.ts.
 *
 * LAZ-852 caveat: page-level suggestions are suppressed for mods *set to use file
 * requirements* while the file-requirements flag is on. 46415 must keep its legacy
 * mod requirements enabled for this suggestion to surface for the flag-enrolled E2E
 * users; if these fail at the first suggestions.row() assertion, re-confirm the
 * fixture still shows a suggestion.
 *
 * Heavy (real Mod-Manager download) + authenticated; needs CI (captured auth). The
 * shared setup lives in helpers/healthCheck.ts (openModRequirementSuggestion).
 */
import { test, expect } from "../fixtures/vortex-app";
import { openModRequirementSuggestion } from "../helpers/healthCheck";
import { dismissAllNotifications } from "../helpers/notifications";
import { freeUser } from "../helpers/users";
import { HealthCheckPremiumModal, HealthCheckSuggestionDetail } from "../selectors/healthCheck";

test.describe("Health Check - mod requirement suggestions", () => {
  test.describe("free user", () => {
    test.use({ nexusUser: freeUser });

    test("Check a page-level requirement renders as a suggestion with its detail and disclaimer", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { suggestions } = await openModRequirementSuggestion(
        nexusPage,
        vortexApp,
        vortexWindow,
      );
      const detail = new HealthCheckSuggestionDetail(vortexWindow);

      await test.step("The suggestion lists the missing mod", async () => {
        await expect(suggestions.missingMod()).toBeVisible();
      });

      await test.step("Open the suggestion detail view", async () => {
        await suggestions.title().click();
        await expect(detail.suggestionTitle).toBeVisible();
      });

      await test.step("Detail states that the mod file may be required", async () => {
        await expect(detail.mayRequireLine).toBeVisible();
      });

      await test.step("Detail carries the 'identified from the mod page' disclaimer", async () => {
        await expect(detail.modPageSourceNote).toBeVisible();
      });

      await test.step("Detail feedback prompt uses the suggestion wording", async () => {
        await expect(detail.feedbackPrompt).toBeVisible();
      });
    });

    test("Check a free user's 1-click on a suggestion opens the Premium upsell", async ({
      vortexApp,
      vortexWindow,
      managedGame: _game,
      nexusPage,
    }) => {
      const { suggestions } = await openModRequirementSuggestion(
        nexusPage,
        vortexApp,
        vortexWindow,
      );
      const premiumModal = new HealthCheckPremiumModal(vortexWindow);

      await test.step("1-click opens the single-file Premium upsell", async () => {
        await dismissAllNotifications(vortexWindow);
        await suggestions.installOneClick().click();
        await expect(premiumModal.singleTitle).toBeVisible();
      });
    });
  });
});
