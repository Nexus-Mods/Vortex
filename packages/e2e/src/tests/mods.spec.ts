/**
 * QA-108: free + premium user can download a mod via the Mod Manager link.
 * SMAPI (mods/2400) — picked because it has no further prerequisites, so the
 * install completes cleanly. Premium users skip the slow-download interstitial.
 */
import { test, expect, type NexusUser } from "../fixtures/vortex-app";
import { acceptConsent } from "../helpers/consent";
import { installNxmCapture, waitForNxmUrl } from "../helpers/nxmCapture";
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
        await test.step("Open the SMAPI mod page", async () => {
          await nexusPage.goto(SDV_MOD_URL, {
            waitUntil: "domcontentloaded",
            timeout: Timeouts.NETWORK,
          });
          await expect(nexusPage).toHaveURL(/stardewvalley\/mods\/2400/);
          await acceptConsent(nexusPage);
        });

        let nxmUrl: string | null = null;

        await test.step("Open the Mod Manager Download requirements modal", async () => {
          const modManagerLink = nexusPage
            .getByRole("link", { name: /mod manager download|vortex/i })
            .first();
          await expect(modManagerLink).toBeVisible({ timeout: Timeouts.NETWORK });
          await modManagerLink.click({ timeout: Timeouts.NETWORK });

          const modal = nexusPage
            .locator('.popup, .modal, [role="dialog"], #popup-content')
            .first();
          const modalAppeared = await modal
            .waitFor({ state: "visible" })
            .then(() => true)
            .catch(() => false);

          if (modalAppeared) {
            // Premium users (and dep-free mods) skip this confirmation —
            // the nxm:// URL fires directly without an inner Download link.
            const modalDownloadButton = modal.getByRole("link", { name: /^download$/i }).first();
            if (await modalDownloadButton.isVisible().catch(() => false)) {
              await modalDownloadButton.click({ timeout: Timeouts.NETWORK });
            }
          }
        });

        await test.step("Capture the nxm:// URL", async () => {
          await nexusPage
            .waitForLoadState("load", { timeout: Timeouts.NETWORK })
            .catch(() => undefined);
          await acceptConsent(nexusPage);
          await installNxmCapture(nexusPage);

          // Free users see a Slow-download interstitial; premium users don't.
          const slowDownloadButton = nexusPage.getByRole("button", {
            name: "Slow download",
          });
          if (
            await slowDownloadButton
              .first()
              .isVisible()
              .catch(() => false)
          ) {
            await slowDownloadButton
              .first()
              .click({ timeout: Timeouts.NETWORK })
              .catch(() => undefined);
          }

          nxmUrl = await waitForNxmUrl(nexusPage, Timeouts.NETWORK);
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
          const navbar = new NavBar(vortexWindow);
          await navbar.modsLink.click();

          const modRow = vortexWindow.getByText(/SMAPI/i).first();
          await expect(modRow).toBeVisible({ timeout: Timeouts.NETWORK });
        });
      });
    });
  }
});
