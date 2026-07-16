import os from "node:os";
import path from "node:path";

/**
 * QA-176 (SDV [#14.7] manual mod download) — also covers QA-109 (Mods [9.2]).
 * Skips the post-install "Click Play" verification (the fake-game fixture
 * has no real launcher). Native file picker is bypassed by overriding
 * dialog.showOpenDialog from the test side.
 */
import { SDV_MOD_URL } from "../constants";
import { test, expect, type NexusUser } from "../fixtures/vortex-app";
import { acceptConsent } from "../helpers/consent";
import { Timeouts } from "../helpers/timeouts";
import { freeUser, premiumUser } from "../helpers/users";
import { ModsPage } from "../selectors/modsPage";
import { NavBar } from "../selectors/navbar";
import { NexusModPage } from "../selectors/nexusModPage";

const TIERS = [
  { tier: "free", user: freeUser },
  { tier: "premium", user: premiumUser },
] as const satisfies readonly { tier: string; user: NexusUser }[];

test.describe("Mods - Manual Downloads", () => {
  for (const { tier, user } of TIERS) {
    test.describe(tier, () => {
      test.use({ nexusUser: user });

      test(`[QA-176] ${tier} user can manually download SMAPI and Install From File`, async ({
        vortexApp,
        vortexWindow,
        managedGame: _g,
        nexusPage,
      }) => {
        const nexusModPage = new NexusModPage(nexusPage);

        await test.step("Open the SMAPI mod page", async () => {
          await nexusPage.goto(SDV_MOD_URL, {
            waitUntil: "domcontentloaded",
            timeout: Timeouts.NETWORK,
          });
          await expect(nexusPage).toHaveURL(/stardewvalley\/mods\/2400/);
          await acceptConsent(nexusPage);
        });

        let downloadedFilePath: string | null = null;

        await test.step("Click Manual and capture the download", async () => {
          // Premium skips the slow-download interstitial — set up the listener
          // first so both paths funnel through the same waitForEvent.
          const downloadPromise = nexusPage.waitForEvent("download", {
            timeout: Timeouts.NETWORK,
          });

          await expect(nexusModPage.manualDownloadLink).toBeVisible({
            timeout: Timeouts.NETWORK,
          });
          await nexusModPage.manualDownloadLink.click({ timeout: Timeouts.NETWORK });
          await nexusPage
            .waitForLoadState("load", { timeout: Timeouts.NETWORK })
            .catch(() => undefined);
          await acceptConsent(nexusPage);

          if (await nexusModPage.slowDownloadButton.isVisible().catch(() => false)) {
            await nexusModPage.slowDownloadButton
              .click({ timeout: Timeouts.NETWORK })
              .catch(() => undefined);
          }

          const download = await downloadPromise;
          const filename = download.suggestedFilename();
          downloadedFilePath = path.join(os.tmpdir(), `qa-e2e-${tier}-${Date.now()}-${filename}`);
          await download.saveAs(downloadedFilePath);
        });

        await test.step("Stub dialog.showOpenDialog to return the saved file", async () => {
          if (downloadedFilePath === null) {
            throw new Error("File path was not captured");
          }
          await vortexApp.evaluate(({ dialog }, filePath) => {
            dialog.showOpenDialog = () =>
              Promise.resolve({
                canceled: false,
                filePaths: [filePath],
              });
          }, downloadedFilePath);
        });

        await test.step("Click Install From File in Vortex", async () => {
          const navbar = new NavBar(vortexWindow);
          await navbar.modsLink.click();

          const modsPage = new ModsPage(vortexWindow);
          await expect(modsPage.installFromFileButton).toBeVisible({
            timeout: Timeouts.NETWORK,
          });
          await modsPage.installFromFileButton.click({ timeout: Timeouts.NETWORK });
        });

        await test.step("Verify SMAPI is installed in Vortex", async () => {
          const modsPage = new ModsPage(vortexWindow);
          await expect(modsPage.modRow(/SMAPI/i)).toBeVisible({
            timeout: Timeouts.NETWORK,
          });
        });
      });
    });
  }
});
