import fs from "node:fs";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

import { ModsPage, type ModStatus } from "../selectors/modsPage";

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
