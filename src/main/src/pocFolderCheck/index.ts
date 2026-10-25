/**
 * Dev-only PoC: serves the Steam game folder check to the renderer. One check per app id runs at
 * a time; its result is kept in memory for the session and only a forced start runs it again.
 * See docs/superpowers/specs/2026-10-25-steam-game-folder-check-poc-design.md.
 */
import type { FolderCheckInput, FolderCheckMode, FolderCheckStatus } from "@vortex/shared/ipc";

import { betterIpcMain } from "../ipc";
import { log } from "../logging";
import { FolderCheckUnavailable, runFolderCheck } from "./scan";

export function createFolderCheckService(run = runFolderCheck): {
  start(input: FolderCheckInput, force: boolean, mode: FolderCheckMode): void;
  status(appId: number): FolderCheckStatus;
} {
  const statuses = new Map<number, FolderCheckStatus>();

  return {
    start(input, force, mode) {
      const current = statuses.get(input.appId);
      if (current?.state === "running" || (current?.state === "done" && !force)) {
        return;
      }
      statuses.set(input.appId, {
        state: "running",
        phase: "listing",
        bytesDone: 0,
        bytesTotal: 0,
      });
      run(input, (progress) => statuses.set(input.appId, progress), mode).then(
        (result) => statuses.set(input.appId, { state: "done", result }),
        (err: unknown) => {
          if (err instanceof FolderCheckUnavailable) {
            statuses.set(input.appId, { state: "unavailable", reason: err.message });
          } else {
            const message = err instanceof Error ? err.message : String(err);
            log("warn", "Steam folder check failed", { appId: input.appId, error: message });
            statuses.set(input.appId, { state: "error", message });
          }
        },
      );
    },
    status(appId) {
      return statuses.get(appId) ?? { state: "idle" };
    },
  };
}

export function initPocFolderCheck(): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  log("info", "Steam folder check PoC enabled");
  const service = createFolderCheckService();
  betterIpcMain.handle("poc:folder-check-start", (_, input, force, mode) => {
    service.start(input, force, mode);
    return Promise.resolve();
  });
  betterIpcMain.handle("poc:folder-check-status", (_, appId) =>
    Promise.resolve(service.status(appId)),
  );
}
