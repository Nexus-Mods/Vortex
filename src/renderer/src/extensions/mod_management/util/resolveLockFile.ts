import { FileSourceKind, resolve } from "@nexusmods/mod-pipeline";
import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { fileMD5 } from "../../../util/checksum";
import { gatherGameFacts } from "./gameFacts";

/** The games whose lockfile is resolved after each plugin sort. */
const RESOLVED_GAMES: ReadonlySet<string> = new Set(["skyrimse"]);

async function logResolvedLockfile(
  api: IExtensionApi,
  gameMode: string,
  hashFile: (filePath: string) => Promise<string>,
): Promise<void> {
  const startedAt = Date.now();
  try {
    const lockfile = resolve(api.getState(), await gatherGameFacts(api, gameMode, hashFile));
    log("info", "resolved lockfile", {
      gameMode,
      files: lockfile.files.length,
      nexusFiles: lockfile.files.filter((file) => file.source === FileSourceKind.Nexus).length,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (err) {
    log("warn", "failed to resolve lockfile", {
      gameMode,
      error: getErrorMessageOrDefault(err),
    });
  }
}

/** Resolves and logs the lockfile once a plugin sort has run after a deployment. */
export function registerResolveLockFile(
  api: IExtensionApi,
  hashFile: (filePath: string) => Promise<string> = fileMD5,
): void {
  api.events.on("did-sort-plugins", (gameId: string) => {
    if (RESOLVED_GAMES.has(gameId)) {
      void logResolvedLockfile(api, gameId, hashFile);
    }
  });
}
