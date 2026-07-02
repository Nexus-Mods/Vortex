/**
 * QA-112: Mods [9.5] — I can deploy mods from the Mods list.
 *
 * Simplified, automatable slice of the ticket: with auto-enable and auto-deploy
 * turned off (auto-install left on), a downloaded mod installs into the Mods
 * list but stays Disabled and undeployed. This exercises the manual path —
 * enable the mod, then Deploy it from the Mods list — which is the heart of the
 * ticket ("I can deploy mods from Mods list"). Runs for both free and premium.
 *
 * The ticket's "launch the game and verify the menu changed" steps are NOT
 * automatable here: the fake Stardew Valley fixture has no real launcher or
 * renderer (see mods-manual.spec.ts). SMAPI (mods/2400) is used because it
 * installs with no further prerequisites.
 */
import { test, expect, type NexusUser } from "../fixtures/vortex-app";
import { acceptConsent } from "../helpers/consent";
import { installNxmCapture, waitForNxmUrl } from "../helpers/nxmCapture";
import { Timeouts } from "../helpers/timeouts";
import { freeUser, premiumUser } from "../helpers/users";
import { ModsPage } from "../selectors/modsPage";
import { NavBar } from "../selectors/navbar";
import { NexusModPage } from "../selectors/nexusModPage";
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
        await test.step("Open global Settings → Interface", async () => {
          const navbar = new NavBar(vortexWindow);
          // Settings lives in the global workspace, not the per-game spine, so
          // leave the game workspace via the top-bar Home button first.
          await navbar.homeButton.click();
          await expect(navbar.settingsLink).toBeVisible({ timeout: Timeouts.NETWORK });
          await navbar.settingsLink.click();

          const settings = new SettingsPage(vortexWindow);
          await expect(settings.interfaceTab).toBeVisible();
          await settings.interfaceTab.click();
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

        let nxmUrl: string | null = null;

        await test.step("Open the SMAPI mod page and start a Mod Manager download", async () => {
          await nexusPage.goto(SDV_MOD_URL, {
            waitUntil: "domcontentloaded",
            timeout: Timeouts.NETWORK,
          });
          await expect(nexusPage).toHaveURL(/stardewvalley\/mods\/2400/);
          await acceptConsent(nexusPage);

          const modPage = new NexusModPage(nexusPage);

          // Install the nxm:// capture before clicking: a premium user's
          // download can fire immediately (no Slow-download interstitial),
          // before the post-navigation reinstall below.
          await installNxmCapture(nexusPage);

          // Premium triggers a direct nxm:// navigation, which Chrome can't
          // follow and which never lands in the DOM — but the attempt surfaces
          // as a network request. Arm a listener up front; free users are still
          // covered by the DOM scan (waitForNxmUrl) below.
          const nxmFromRequest = nexusPage
            .waitForRequest((req) => req.url().startsWith("nxm:"), { timeout: Timeouts.NETWORK })
            .then((req) => req.url())
            .catch(() => null);

          await expect(modPage.modManagerDownload).toBeVisible({ timeout: Timeouts.NETWORK });
          await modPage.modManagerDownload.click({ timeout: Timeouts.NETWORK });

          if (
            await modPage.downloadModal
              .waitFor({ state: "visible" })
              .then(() => true)
              .catch(() => false)
          ) {
            if (await modPage.modalDownloadLink.isVisible().catch(() => false)) {
              await modPage.modalDownloadLink.click({ timeout: Timeouts.NETWORK });
            }
          }

          await nexusPage
            .waitForLoadState("load", { timeout: Timeouts.NETWORK })
            .catch(() => undefined);
          await acceptConsent(nexusPage);
          await installNxmCapture(nexusPage);

          // Free users see a Slow-download interstitial; premium users don't.
          if (await modPage.slowDownloadButton.isVisible().catch(() => false)) {
            await modPage.slowDownloadButton
              .click({ timeout: Timeouts.NETWORK })
              .catch(() => undefined);
          }

          nxmUrl = (await nxmFromRequest) ?? (await waitForNxmUrl(nexusPage, Timeouts.NETWORK));
          expect(nxmUrl).not.toBeNull();
        });

        await test.step("Forward the nxm:// URL to Vortex (auto-installs the mod)", async () => {
          // waitForNxmUrl may scrape the URL from the page DOM, where the query
          // separators are HTML-entity-encoded (&amp;). Left encoded, Vortex's
          // download_link request is malformed and the server returns HTTP 403.
          const url = (nxmUrl as string).replace(/&amp;/g, "&");
          await vortexApp.evaluate(({ BrowserWindow }, u) => {
            const target = BrowserWindow.getAllWindows().find((win) =>
              win.webContents.getURL().includes("index.html"),
            );
            if (target === undefined) throw new Error("Vortex main window not found");
            target.webContents.send("external-url", u, undefined, false);
          }, url);
        });

        await test.step("Open the game's Mods page", async () => {
          // Re-enter the game workspace (we left it for the global Settings page).
          await vortexWindow
            .getByRole("button", { name: "Stardew Valley", exact: true })
            .first()
            .click();
          const navbar = new NavBar(vortexWindow);
          await navbar.modsLink.click();
        });

        await test.step("Wait for the mod to finish auto-installing", async () => {
          // The download + install runs asynchronously after the nxm forward;
          // wait for the empty-state to clear before inspecting the mod row.
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
