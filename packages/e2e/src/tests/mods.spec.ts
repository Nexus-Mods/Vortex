/**
 * QA-108: free + premium user can download a mod via the Mod Manager link.
 * SMAPI (mods/2400) — picked because it has no further prerequisites, so the
 * install completes cleanly. Premium users skip the slow-download interstitial.
 */
import { test, expect, type NexusUser } from "../fixtures/vortex-app";
import { downloadModViaModManager } from "../helpers/modDownload";
import { Timeouts } from "../helpers/timeouts";
import { freeUser, premiumUser } from "../helpers/users";
import { NavBar } from "../selectors/navbar";

const SDV_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/2400";

const TIERS = [
  { tier: "free", user: freeUser },
  { tier: "premium", user: premiumUser },
] as const satisfies readonly { tier: string; user: NexusUser }[];

test.describe("Mods - Downloads", () => {
  for (const { tier, user } of TIERS) {
    test.describe(tier, () => {
      test.use({ nexusUser: user });

      test(`[QA-108] ${tier} user can download SMAPI via the Mod Manager link`, async ({
        vortexApp,
        vortexWindow,
        managedGame: _g,
        nexusPage,
      }) => {
        await test.step("Download SMAPI via the Mod Manager link", async () => {
          await downloadModViaModManager(nexusPage, vortexApp, SDV_MOD_URL);
        });

        await test.step("Verify SMAPI is installed in Vortex", async () => {
          const navbar = new NavBar(vortexWindow);
          await navbar.modsLink.click();

          const modRow = vortexWindow.getByText(/SMAPI/i).first();
          await expect(modRow).toBeVisible({ timeout: Timeouts.NETWORK });
        });
      });
    });
  }
});
