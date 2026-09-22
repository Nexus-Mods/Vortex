import { stat } from "node:fs/promises";
import path from "node:path";

import { getErrorMessageOrDefault } from "@vortex/shared";
import { ProcessCanceled } from "@vortex/shared/errors";
import exeVersion from "exe-version";

import { log } from "@/logging";

import type { IGame } from "../../../types/IGame";
import type { IDiscoveryResult } from "../types/IDiscoveryResult";

export type GameVersionResolver = (game: IGame, discovery: IDiscoveryResult) => Promise<string>;

async function fromExtension(game: IGame, discovery: IDiscoveryResult): Promise<string> {
  return game.getGameVersion(discovery.path, discovery.executable || game.executable());
}

async function fromExecutable(game: IGame, discovery: IDiscoveryResult): Promise<string> {
  const exePath = path.join(discovery.path, discovery.executable || game.executable());

  try {
    await stat(exePath);
    return exeVersion(exePath);
  } catch {
    return "0.0.0";
  }
}

export const resolveGameVersion: GameVersionResolver = async (game, discovery) => {
  if (discovery?.path === undefined || !game?.executable?.(discovery.path)) {
    throw new ProcessCanceled("Game is not discovered");
  }

  if (game.getGameVersion !== undefined) {
    try {
      const version = await fromExtension(game, discovery);
      if (typeof version === "string") {
        return version;
      }

      log("warn", "getGameVersion functor returned an invalid type", {
        extension: game.extensionPath,
      });
    } catch (err) {
      log("warn", "extension getGameVersion call failed", {
        message: getErrorMessageOrDefault(err),
        stack: err instanceof Error ? err.stack : undefined,
        extension: game.extensionPath,
      });
    }
  }

  return fromExecutable(game, discovery);
};
