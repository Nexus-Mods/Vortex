/**
 * QA-108: free + premium user can download a mod via the Mod Manager link.
 * SMAPI (mods/2400) — picked because it has no further prerequisites, so the
 * install completes cleanly. Premium users skip the slow-download interstitial.
 */
import { test, type NexusUser } from "../fixtures/vortex-app";
import { installModManagerDownload } from "../helpers/modManagerDownload";
import { Timeouts } from "../helpers/timeouts";
import { freeUser, premiumUser } from "../helpers/users";

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
        await test.step("Install SMAPI from Nexus via Mod Manager Download", async () => {
          await installModManagerDownload({
            expectedModRow: /SMAPI/i,
            expectedUrl: /stardewvalley\/mods\/2400/,
            missingNxmMessage: "No nxm:// URL appeared in the page after the download click",
            modUrl: SDV_MOD_URL,
            nexusPage,
            timeoutMs: Timeouts.NETWORK,
            vortexApp,
            vortexWindow,
          });
        });
      });
    });
  }
});
