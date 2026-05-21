/**
 * QA-108: free + premium user can download a mod via the Mod Manager link.
 * SMAPI (mods/2400) — picked because it has no further prerequisites, so the
 * install completes cleanly. Premium users skip the slow-download interstitial.
 */
import type { Browser } from "@playwright/test";

import { cleanupFakeGame } from "../fixtures/game-setup/fake-game";
import { test, expect } from "../fixtures/vortex-app";
import { acceptConsent } from "../helpers/consent";
import { manageGame, type ManagedGame } from "../helpers/games";
import { loginToNexus } from "../helpers/login";
import { installNxmCapture, waitForNxmUrl } from "../helpers/nxmCapture";
import { freeUser, premiumUser } from "../helpers/users";
import { NavBar } from "../selectors/navbar";

const SDV_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/2400";

const TIERS = [
  { tier: "free", user: freeUser },
  { tier: "premium", user: premiumUser },
] as const;

test.describe("Mods - Downloads", () => {
  // Fresh Vortex per test so login state and managed game don't leak.
  test.describe.configure({ mode: "parallel" });

  for (const { tier, user } of TIERS) {
    test(`[QA-108] ${tier} user can download SMAPI via the Mod Manager link`, async ({
      vortexApp,
      vortexWindow,
    }) => {
      test.setTimeout(180_000);

      let managed: ManagedGame | null = null;
      let authBrowser: Browser | null = null;

      try {
        // Login before manageGame — Vortex's login UI selectors only match
        // reliably while no game is active.
        const auth = await loginToNexus(vortexApp, vortexWindow, user, {
          keepBrowser: true,
          headless: false,
        });
        if (auth === null) {
          throw new Error("loginToNexus did not return a browser handle");
        }
        authBrowser = auth.browser;

        managed = await manageGame(vortexWindow, "stardewvalley");

        await test.step("Open the SMAPI mod page", async () => {
          await auth.page.goto(SDV_MOD_URL, {
            waitUntil: "domcontentloaded",
            timeout: 60_000,
          });
          await expect(auth.page).toHaveURL(/stardewvalley\/mods\/2400/);

          const cloudflareHeading = auth.page.getByRole("heading", {
            name: /Performing security verification/i,
          });
          if (await cloudflareHeading.isVisible().catch(() => false)) {
            await expect(cloudflareHeading).toBeHidden({ timeout: 30_000 });
          }

          await acceptConsent(auth.page);
        });

        let nxmUrl: string | null = null;

        await test.step("Open the Mod Manager Download requirements modal", async () => {
          const modManagerLink = auth.page
            .getByRole("link", { name: /mod manager download|vortex/i })
            .first();
          await expect(modManagerLink).toBeVisible({ timeout: 30_000 });
          await modManagerLink.click({ timeout: 15_000 });

          const modal = auth.page
            .locator('.popup, .modal, [role="dialog"], #popup-content')
            .first();
          const modalAppeared = await modal
            .waitFor({ state: "visible", timeout: 5_000 })
            .then(() => true)
            .catch(() => false);

          if (modalAppeared) {
            // Premium users (and dep-free mods) skip this confirmation —
            // the nxm:// URL fires directly without an inner Download link.
            const modalDownloadButton = modal.getByRole("link", { name: /^download$/i }).first();
            if (await modalDownloadButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await modalDownloadButton.click({ timeout: 15_000 });
            }
          }
        });

        await test.step("Capture the nxm:// URL", async () => {
          await auth.page.waitForLoadState("load", { timeout: 30_000 }).catch(() => undefined);
          await acceptConsent(auth.page);
          await installNxmCapture(auth.page);

          // Free users see a Slow-download interstitial; premium users don't.
          const slowDownloadButton = auth.page.getByRole("button", {
            name: "Slow download",
          });
          if (
            await slowDownloadButton
              .first()
              .isVisible({ timeout: 5_000 })
              .catch(() => false)
          ) {
            await slowDownloadButton
              .first()
              .click({ timeout: 15_000 })
              .catch(() => undefined);
          }

          nxmUrl = await waitForNxmUrl(auth.page, 60_000);
          if (nxmUrl === null) {
            throw new Error("No nxm:// URL appeared in the page after the download click");
          }
        });

        await test.step("Forward the nxm:// URL to Vortex via IPC", async () => {
          if (nxmUrl === null) {
            throw new Error("nxmUrl was not captured");
          }
          await vortexApp.evaluate(({ BrowserWindow }, url) => {
            const target = BrowserWindow.getAllWindows().find((win) =>
              win.webContents.getURL().includes("index.html"),
            );
            if (target === undefined) {
              throw new Error("Vortex main window not found");
            }
            target.webContents.send("external-url", url, undefined, false);
          }, nxmUrl);
        });

        await test.step("Verify SMAPI is installed in Vortex", async () => {
          await vortexWindow.waitForTimeout(5_000);

          const navbar = new NavBar(vortexWindow);
          await navbar.modsLink.click();

          const modRow = vortexWindow.getByText(/SMAPI/i).first();
          await expect(modRow).toBeVisible({ timeout: 60_000 });
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
