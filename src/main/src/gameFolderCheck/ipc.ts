/**
 * IPC for the Steam game folder check (MOD-80). The renderer decides when a check runs; main does
 * the disk work and hands the result back through a callback, because only the renderer can
 * authenticate the telemetry send.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { GameFolderCheckInput } from "@vortex/shared/ipc";

import { getVortexPath } from "../getVortexPath";
import { betterIpcMain } from "../ipc";
import { showItemInFolder } from "../open";
import type { IRunOutput } from "./run";
import { GameFolderCheckService } from "./service";

const SUBMIT_TIMEOUT_MS = 60_000;

async function writeReport(input: GameFolderCheckInput, output: IRunOutput): Promise<string> {
  const folder = path.join(getVortexPath("temp"), "game-folder-check");
  await mkdir(folder, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(folder, `${input.gameId}-${stamp}.json`);
  await writeFile(reportPath, JSON.stringify(output, undefined, 2), "utf8");
  return reportPath;
}

export function initGameFolderCheckIpc(service = new GameFolderCheckService()): void {
  let collationId = 0;

  // resolves when the check is finished: submitted, cancelled, or failed (rejects)
  betterIpcMain.handle("game-folder-check:start", async (event, input) => {
    const output = await service.schedule(input);
    if (output === undefined) return;
    await betterIpcMain.callback(
      "game-folder-check:submit",
      event.sender,
      SUBMIT_TIMEOUT_MS,
      ++collationId,
      output.result,
    );
  });

  betterIpcMain.on("game-folder-check:cancel", (_event, gameId) => {
    service.cancel(gameId);
  });

  if (process.env.NODE_ENV === "development") {
    betterIpcMain.handle("game-folder-check:run-manual", async (_event, input) => {
      const output = await service.schedule(input);
      if (output === undefined) throw new Error("game folder check was cancelled");
      const reportPath = await writeReport(input, output);
      showItemInFolder(reportPath);
      return reportPath;
    });
  }
}
