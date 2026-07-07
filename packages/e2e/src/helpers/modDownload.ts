import { type ElectronApplication, expect, type Page } from "@playwright/test";

import { test } from "../fixtures/vortex-app";
import { NexusModPage } from "../selectors/nexusModPage";
import { acceptConsent } from "./consent";
import { installNxmCapture, waitForNxmUrl } from "./nxmCapture";
import { Timeouts } from "./timeouts";

export async function downloadModViaModManager(
  nexusPage: Page,
  vortexApp: ElectronApplication,
  modUrl: string,
): Promise<void> {
  const modPage = new NexusModPage(nexusPage);
  let nxmUrl: string | null = null;

  await test.step(`Start a Mod Manager download from ${modUrl}`, async () => {
    await nexusPage.goto(modUrl, { waitUntil: "domcontentloaded", timeout: Timeouts.NETWORK });
    await acceptConsent(nexusPage);

    // Install the nxm:// capture before clicking: a premium user's download can
    // fire immediately (no Slow-download interstitial), before the
    // post-navigation reinstall below.
    await installNxmCapture(nexusPage);

    // Premium triggers a direct nxm:// navigation, which Chrome can't follow and
    // which never lands in the DOM — but the attempt surfaces as a network
    // request. Arm a listener up front; free users are covered by the DOM scan
    // (waitForNxmUrl) below.
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

    await nexusPage.waitForLoadState("load", { timeout: Timeouts.NETWORK }).catch(() => undefined);
    await acceptConsent(nexusPage);
    await installNxmCapture(nexusPage);

    if (await modPage.slowDownloadButton.isVisible().catch(() => false)) {
      await modPage.slowDownloadButton.click({ timeout: Timeouts.NETWORK }).catch(() => undefined);
    }

    nxmUrl = (await nxmFromRequest) ?? (await waitForNxmUrl(nexusPage, Timeouts.NETWORK));
    expect(nxmUrl).not.toBeNull();
  });

  await test.step("Forward the nxm:// URL to Vortex", async () => {
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
}
