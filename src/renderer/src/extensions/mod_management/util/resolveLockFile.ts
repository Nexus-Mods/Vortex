import { addGeneratedFiles, FileSourceKind, resolve, type Lockfile } from "@nexusmods/mod-pipeline";
import { getErrorMessageOrDefault, VortexGameId } from "@vortex/shared";

import { log } from "../../../logging";
import type { IRegisteredExtension } from "../../../types/extensions";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { fileMD5 } from "../../../util/checksum";
import { lastActiveProfileForGame } from "../../profile_management/selectors";
import {
  LockfileContributions,
  type LockfileContribution,
  type LockfileContributionCondition,
} from "./lockfileContributions";
import { gatherResolverInput } from "./resolverInput";

/** The games whose lockfile is resolved after each plugin sort. */
const RESOLVED_GAMES: ReadonlySet<string> = new Set(["skyrimse"]);

/** The name a contribution is reported under: its extension's name, else its path. */
export function contributorOf(
  extensionPath?: string,
  extInfo?: Partial<IRegisteredExtension>,
): string {
  return extInfo?.name ?? extensionPath ?? "unknown";
}

const registeredContributions = new LockfileContributions();

/** Registers a contribution; the extension manager appends the caller's path and info. */
export function registerLockfileContribution(
  condition: LockfileContributionCondition,
  generate: LockfileContribution,
  extensionPath?: string,
  extInfo?: Partial<IRegisteredExtension>,
): void {
  registeredContributions.register(contributorOf(extensionPath, extInfo), condition, generate);
}

/** The game's lockfile: its enabled mods' files, then the files contributions declare. */
export async function resolveLockfile(
  api: IExtensionApi,
  gameMode: VortexGameId,
  contributions: LockfileContributions,
  hashFile: (filePath: string) => Promise<string>,
): Promise<Lockfile> {
  const state = api.getState();
  const input = await gatherResolverInput(api, gameMode, hashFile);
  const generatedFiles = await contributions.generatedFiles(
    state,
    gameMode,
    lastActiveProfileForGame(state, gameMode),
  );
  return addGeneratedFiles(resolve(input), generatedFiles);
}

async function logResolvedLockfile(
  api: IExtensionApi,
  gameMode: VortexGameId,
  hashFile: (filePath: string) => Promise<string>,
): Promise<void> {
  const startedAt = Temporal.Now.instant();
  try {
    const lockfile = await resolveLockfile(api, gameMode, registeredContributions, hashFile);
    log("info", "resolved lockfile", {
      gameMode,
      files: lockfile.files.length,
      nexusFiles: lockfile.files.filter((file) => file.source === FileSourceKind.Nexus).length,
      generatedFiles: lockfile.files.filter(
        (file) => file.source === FileSourceKind.VortexGenerated,
      ).length,
      elapsedMs: Temporal.Now.instant().since(startedAt).total("milliseconds"),
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
      void logResolvedLockfile(api, VortexGameId(gameId), hashFile);
    }
  });
}
