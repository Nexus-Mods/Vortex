import fs from "node:fs";
import path from "node:path";

import { expect, type ElectronApplication, type Page } from "@playwright/test";

import { GAME_CONFIGS } from "../fixtures/game-setup/fake-game";
import { test } from "../fixtures/vortex-app";
import { MOD_STATUS, ModsPage, type ModStatus } from "../selectors/modsPage";
import { NavBar } from "../selectors/navbar";
import { downloadModViaModManager } from "./modDownload";
import { Timeouts } from "./timeouts";

export const SDV_GAME_ID = "stardewvalley";
export const SMAPI_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/2400";
export const TARGET_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/4697";
export const SMAPI_NAME = /SMAPI/i;
export const TARGET_MOD_NAME = /Vintage Interface/i;

export async function installStardewTestMods(
  nexusPage: Page,
  vortexApp: ElectronApplication,
  vortexWindow: Page,
): Promise<void> {
  await downloadModViaModManager(nexusPage, vortexApp, SMAPI_MOD_URL);
  await downloadModViaModManager(nexusPage, vortexApp, TARGET_MOD_URL);

  await test.step("Open the Mods page", async () => {
    const navbar = new NavBar(vortexWindow);
    await navbar.modsLink.click();
    const modsPage = new ModsPage(vortexWindow);
    await expect(modsPage.row(SMAPI_NAME)).toBeVisible({ timeout: Timeouts.NETWORK });
  });

  await test.step("The target mod is installed and enabled", async () => {
    await expectModStatus(vortexWindow, TARGET_MOD_NAME, MOD_STATUS.enabled, {
      timeout: Timeouts.NETWORK,
    });
  });
}

export async function expectModStatus(
  vortexWindow: Page,
  modName: string | RegExp,
  status: ModStatus,
  options?: { timeout?: number },
): Promise<void> {
  const modsPage = new ModsPage(vortexWindow);
  await expect(modsPage.statusButtonInRow(modName)).toHaveText(status, options);
}

export async function expectArchiveOnDisk(
  vortexUserDataDir: string,
  gameId: string,
  archiveName: RegExp,
  present: boolean,
  options?: { timeout?: number },
): Promise<void> {
  const downloadsDir = path.join(vortexUserDataDir, "userData", "downloads", gameId);
  await expect
    .poll(() => {
      if (!fs.existsSync(downloadsDir)) return false;
      return fs.readdirSync(downloadsDir).some((file) => archiveName.test(file));
    }, options)
    .toBe(present);
}

export async function expectModDeployed(
  gamePath: string,
  gameId: keyof typeof GAME_CONFIGS,
  modName: RegExp,
  present: boolean,
  options?: { timeout?: number },
): Promise<void> {
  const modsDir = path.join(gamePath, GAME_CONFIGS[gameId].modFolderPath ?? "");
  await expect.poll(() => containsMatch(modsDir, modName), options).toBe(present);
}

function containsMatch(dir: string, pattern: RegExp): boolean {
  if (!fs.existsSync(dir)) return false;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (pattern.test(entry.name)) return true;
    if (entry.isDirectory() && containsMatch(path.join(dir, entry.name), pattern)) return true;
  }
  return false;
}
