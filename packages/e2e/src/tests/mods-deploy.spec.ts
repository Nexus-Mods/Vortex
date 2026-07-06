/**
 * QA-112: Mods [9.5] — I can deploy mods from the Mods list.
 *
 * Checking that with auto-enable and auto-deploy turned off (auto-install
 * left on), a downloaded mod installs into the Mods list but stays Disabled
 * and undeployed. This exercises the manual path — enable the mod, then
 * Deploy it from the Mods list. Runs for both free and premium.
 *
 */
import { test, expect, type NexusUser } from "../fixtures/vortex-app";
import { downloadModViaModManager } from "../helpers/modDownload";
import { Timeouts } from "../helpers/timeouts";
import { freeUser, premiumUser } from "../helpers/users";
import { ModsPage } from "../selectors/modsPage";
import { NavBar } from "../selectors/navbar";
import { AUTOMATION_LABELS, SettingsPage } from "../selectors/settings";

const SDV_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/2400";

const TIERS = [
  { tier: "free", user: freeUser },
  { tier: "premium", user: premiumUser },
] as const satisfies readonly { tier: string; user: NexusUser }[];

test.describe("Mods - Deploy from mods list", () => {
  for (const { tier, user } of TIERS) {
    test.describe(tier, () => {
      test.use({ nexusUser: user });

      test(`[QA-112] ${tier} user manually enables and deploys a mod from the Mods list`, async ({
        vortexApp,
        vortexWindow,
        managedGame: _g,
        nexusPage,
      }) => {
        await test.step("Navigate to Home", async () => {
          const navbar = new NavBar(vortexWindow);
          await navbar.homeButton.click();
          await expect(navbar.settingsLink).toBeVisible({ timeout: Timeouts.NETWORK });
        });
        await test.step("Open global Settings", async () => {
          const navbar = new NavBar(vortexWindow);
          await navbar.settingsLink.click();
          const settings = new SettingsPage(vortexWindow);
          await expect(settings.interfaceTab).toBeVisible();
        });
        await test.step("Open Interface tab", async () => {
          const settings = new SettingsPage(vortexWindow);
          await settings.interfaceTab.click();
          await expect(settings.interfaceTab).toBeEnabled();
        });

        await test.step("Turn off auto-enable and auto-deploy (leave auto-install on)", async () => {
          const settings = new SettingsPage(vortexWindow);
          for (const label of [AUTOMATION_LABELS.enable, AUTOMATION_LABELS.deploy]) {
            const toggle = settings.automationToggle(label);
            await expect(toggle).toHaveClass(/toggle-on/);
            await toggle.click();
            await expect(toggle).toHaveClass(/toggle-off/);
          }
        });

        await test.step("Download SMAPI and forward it to Vortex (auto-installs)", async () => {
          await downloadModViaModManager(nexusPage, vortexApp, SDV_MOD_URL);
        });

        await test.step("Open the SDV game page", async () => {
          await vortexWindow
            .getByRole("button", { name: "Stardew Valley", exact: true })
            .first()
            .click();
        });

        await test.step("Open mod page", async () => {
          const navbar = new NavBar(vortexWindow);
          await navbar.modsLink.click();
          await expect(new ModsPage(vortexWindow).emptyState).toBeHidden({
            timeout: Timeouts.NETWORK,
          });
        });

        await test.step("The mod is installed but Disabled", async () => {
          const modsPage = new ModsPage(vortexWindow);
          await expect(modsPage.statusButton).toHaveText(/disabled/i, {
            timeout: Timeouts.NETWORK,
          });
        });

        await test.step("Enable the mod", async () => {
          const modsPage = new ModsPage(vortexWindow);
          await modsPage.statusButton.click();
          await expect(modsPage.statusButton).toHaveText(/enabled/i);
        });

        await test.step("Deploy mods from the Mods list", async () => {
          const modsPage = new ModsPage(vortexWindow);
          await modsPage.deployButton.click();
          await expect(modsPage.deployedNotification).toBeVisible({
            timeout: Timeouts.NETWORK,
          });
        });
      });
    });
  }
});
