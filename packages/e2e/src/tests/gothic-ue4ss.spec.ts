import fs from "node:fs";

import type { ElectronApplication } from "@playwright/test";

import { fixturePathToNative } from "../fixtures/game-setup/mock-tree";
import { test, expect } from "../fixtures/vortex-app";
import { acceptConsent } from "../helpers/consent";
import { installNxmCapture, waitForNxmUrl } from "../helpers/nxmCapture";
import { Timeouts } from "../helpers/timeouts";
import { freeUser } from "../helpers/users";
import { ModsPage } from "../selectors/modsPage";
import { NavBar } from "../selectors/navbar";

const UE4SS_FILES_URL = "https://www.nexusmods.com/gothic1remake/mods/3?tab=files";
const DEPLOYED_UE4SS_FILES = [
  "G1R/Binaries/Win64/dwmapi.dll",
  "G1R/Binaries/Win64/UE4SS.dll",
  "G1R/Binaries/Win64/UE4SS-settings.ini",
] as const;

async function forwardNxmUrlToVortex(
  vortexApp: ElectronApplication,
  nxmUrl: string,
): Promise<void> {
  await vortexApp.evaluate(({ BrowserWindow }, url) => {
    const target = BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().includes("index.html"),
    );
    if (target === undefined) {
      throw new Error("Vortex main window not found");
    }
    target.webContents.send("external-url", url, undefined, false);
  }, nxmUrl);
}

async function waitForFiles(paths: string[]): Promise<void> {
  await expect
    .poll(() => paths.filter((filePath) => !fs.existsSync(filePath)), {
      timeout: Timeouts.NETWORK,
      message: "Expected UE4SS files to deploy",
    })
    .toEqual([]);
}

test.describe("Gothic 1 Remake - UE4SS", () => {
  test.use({
    nexusUser: freeUser,
    dynamicGameExtensionId: "gothic1remake",
    managedGameId: "gothic1remake",
  });

  test("installs UE4SS from Nexus and deploys injector files", async ({
    vortexApp,
    vortexWindow,
    managedGame,
    nexusPage,
  }) => {
    await test.step("Open UE4SS files page", async () => {
      await installNxmCapture(nexusPage);
      await nexusPage.goto(UE4SS_FILES_URL, {
        waitUntil: "domcontentloaded",
        timeout: Timeouts.NETWORK,
      });
      await expect(nexusPage).toHaveURL(/gothic1remake\/mods\/3/);
      await acceptConsent(nexusPage);
    });

    let nxmUrl: string | null = null;

    await test.step("Capture UE4SS nxm URL", async () => {
      const modManagerLink = nexusPage
        .getByRole("link", { name: /mod manager download|vortex/i })
        .first();
      await expect(modManagerLink).toBeVisible({ timeout: Timeouts.NETWORK });
      await modManagerLink.click({ timeout: Timeouts.NETWORK });

      const modal = nexusPage.locator('.popup, .modal, [role="dialog"], #popup-content').first();
      const modalAppeared = await modal
        .waitFor({ state: "visible", timeout: Timeouts.NETWORK })
        .then(() => true)
        .catch(() => false);

      if (modalAppeared) {
        const modalDownloadButton = modal.getByRole("link", { name: /^download$/i }).first();
        if (await modalDownloadButton.isVisible().catch(() => false)) {
          await modalDownloadButton.click({ timeout: Timeouts.NETWORK });
        }
      }

      await nexusPage
        .waitForLoadState("load", { timeout: Timeouts.NETWORK })
        .catch(() => undefined);
      await acceptConsent(nexusPage);

      const slowDownloadButton = nexusPage.getByRole("button", { name: "Slow download" }).first();
      if (await slowDownloadButton.isVisible().catch(() => false)) {
        await slowDownloadButton.click({ timeout: Timeouts.NETWORK }).catch(() => undefined);
      }

      nxmUrl = await waitForNxmUrl(nexusPage, Timeouts.NETWORK);
      if (nxmUrl === null) {
        throw new Error("No nxm:// URL appeared in the page after the UE4SS download click");
      }
    });

    await test.step("Install UE4SS in Vortex", async () => {
      if (nxmUrl === null) throw new Error("nxmUrl was not captured");
      await forwardNxmUrlToVortex(vortexApp, nxmUrl);

      const navbar = new NavBar(vortexWindow);
      await navbar.modsLink.click();

      const modsPage = new ModsPage(vortexWindow);
      await expect(modsPage.modRow(/UE4SS-3/i)).toBeVisible({ timeout: Timeouts.NETWORK });
    });

    await test.step("Deploy UE4SS", async () => {
      const modsPage = new ModsPage(vortexWindow);
      await expect(modsPage.deployButton).toBeVisible({ timeout: Timeouts.NETWORK });
      await modsPage.deployButton.click({ timeout: Timeouts.NETWORK });
    });

    await test.step("Verify UE4SS deployed to Gothic Win64 folder", async () => {
      await waitForFiles(
        DEPLOYED_UE4SS_FILES.map((relativePath) =>
          fixturePathToNative(managedGame.gamePath, relativePath),
        ),
      );
    });
  });
});
