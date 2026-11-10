import { stat } from "node:fs/promises";
import path from "node:path";

import { getErrorMessageOrDefault } from "@vortex/shared";
import { ProcessCanceled } from "@vortex/shared/errors";
import exeVersion from "exe-version";

import { log } from "@/logging";

import type { IGame } from "../../../types/IGame";
import type { IDiscoveryResult } from "../types/IDiscoveryResult";

export type GameVersionResolver = (game: IGame, discovery: IDiscoveryResult) => Promise<string>;

/** The version the game extension reports through getGameVersion; null when the
    extension provides none or the call fails. */
async function fromExtension(game: IGame, discovery: IDiscoveryResult): Promise<string | null> {
  if (game.getGameVersion === undefined) {
    return null;
  }

  try {
    const version = await game.getGameVersion(
      discovery.path,
      discovery.executable || game.executable(),
    );
    if (typeof version === "string") {
      return version;
    }

    log("warn", "getGameVersion functor returned an invalid type", {
      extension: game.extensionPath,
    });
  } catch (err) {
    log("warn", "extension getGameVersion call failed", {
      err,
      extension: game.extensionPath,
    });
  }
  return null;
}

/** The version attribute of the discovered executable; null when it can't be read. */
async function fromExecutable(game: IGame, discovery: IDiscoveryResult): Promise<string | null> {
  const exePath = path.join(discovery.path, discovery.executable || game.executable());

  try {
    await stat(exePath);
    return exeVersion(exePath);
  } catch {
    return null;
  }
}

function assertDiscovered(game: IGame, discovery: IDiscoveryResult): void {
  if (discovery?.path === undefined || !game?.executable?.(discovery.path)) {
    throw new ProcessCanceled("Game is not discovered");
  }
}

export const resolveGameVersion: GameVersionResolver = async (game, discovery) => {
  // the game knows best when it provides its own resolver (Tier 0 games have
  // no executable for the stock sources to read)
  if (game.getInstalledVersion !== undefined) {
    return game.getInstalledVersion(discovery);
  }

  assertDiscovered(game, discovery);
  return (
    (await fromExtension(game, discovery)) ?? (await fromExecutable(game, discovery)) ?? "0.0.0"
  );
};

/** Both version sources kept apart rather than merged as resolveGameVersion does,
    for telemetry that compares them. */
export async function readGameVersions(
  game: IGame,
  discovery: IDiscoveryResult,
): Promise<{ exe: string | null; extension: string | null }> {
  assertDiscovered(game, discovery);
  return {
    exe: await fromExecutable(game, discovery),
    extension: await fromExtension(game, discovery),
  };
}
