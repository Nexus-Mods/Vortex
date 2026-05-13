import os from "node:os";
import path from "node:path";

/**
 * QA-176 (SDV [#14.7] manual mod download) — also covers QA-109 (Mods [9.2]).
 * Skips the post-install "Click Play" verification (the fake-game fixture
 * has no real launcher). Native file picker is bypassed by overriding
 * dialog.showOpenDialog from the test side.
 */
import type { Browser } from "@playwright/test";

import { cleanupFakeGame } from "../fixtures/game-setup/fake-game";
import { test, expect } from "../fixtures/vortex-app";
import { acceptConsent } from "../helpers/consent";
import { manageGame, type ManagedGame } from "../helpers/games";
import { loginToNexus } from "../helpers/login";
import { freeUser, premiumUser } from "../helpers/users";
import { ModsPage } from "../selectors/modsPage";
import { NavBar } from "../selectors/navbar";
import { NexusModPage } from "../selectors/nexusModPage";

const SDV_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/2400";

const TIERS = [
  { tier: "free", user: freeUser },
  { tier: "premium", user: premiumUser },
] as const;

test.describe("Mods - Manual Downloads", () => {
  test.describe.configure({ mode: "parallel" });

  for (const { tier, user } of TIERS) {
    test(`[QA-176] ${tier} user can manually download SMAPI and Install From File`, async ({
      vortexApp,
      vortexWindow,
    }) => {
      test.setTimeout(180_000);

      let managed: ManagedGame | null = null;
      let authBrowser: Browser | null = null;

      try {
        const auth = await loginToNexus(vortexApp, vortexWindow, user, {
          keepBrowser: true,
          headless: false,
        });
        if (auth === null) {
          throw new Error("loginToNexus did not return a browser handle");
        }
        authBrowser = auth.browser;

        managed = await manageGame(vortexWindow, "stardewvalley");

        const nexusModPage = new NexusModPage(auth.page);

        await test.step("Open the SMAPI mod page", async () => {
          await auth.page.goto(SDV_MOD_URL, {
            waitUntil: "domcontentloaded",
            timeout: 60_000,
          });
          await expect(auth.page).toHaveURL(/stardewvalley\/mods\/2400/);

          if (await nexusModPage.cloudflareHeading.isVisible().catch(() => false)) {
            await expect(nexusModPage.cloudflareHeading).toBeHidden({
              timeout: 30_000,
            });
          }

          await acceptConsent(auth.page);
        });

        let downloadedFilePath: string | null = null;

        await test.step("Click Manual and capture the download", async () => {
          // Premium skips the slow-download interstitial — set up the listener
          // first so both paths funnel through the same waitForEvent.
          const downloadPromise = auth.page.waitForEvent("download", {
            timeout: 120_000,
          });

          await expect(nexusModPage.manualDownloadLink).toBeVisible({
            timeout: 30_000,
          });
          await nexusModPage.manualDownloadLink.click({ timeout: 15_000 });
          await auth.page.waitForLoadState("load", { timeout: 30_000 }).catch(() => undefined);
          await acceptConsent(auth.page);

          if (
            await nexusModPage.slowDownloadButton.isVisible({ timeout: 5_000 }).catch(() => false)
          ) {
            await nexusModPage.slowDownloadButton.click({ timeout: 15_000 }).catch(() => undefined);
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
            dialog.showOpenDialog = async () => ({
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
            timeout: 30_000,
          });
          await modsPage.installFromFileButton.click({ timeout: 15_000 });
        });

        await test.step("Verify SMAPI is installed in Vortex", async () => {
          const modsPage = new ModsPage(vortexWindow);
          await expect(modsPage.modRow(/SMAPI/i)).toBeVisible({
            timeout: 90_000,
          });
        });
      } finally {
        if (authBrowser !== null) {
          await authBrowser.close().catch(() => undefined);
        }
        if (managed !== null) {
          cleanupFakeGame(managed.basePath);
        }
      }
    });
  }
});
