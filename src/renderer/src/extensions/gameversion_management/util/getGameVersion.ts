import path from "path";

import { getErrorMessageOrDefault } from "@vortex/shared";
import { ProcessCanceled } from "@vortex/shared/errors";
import type * as exeVersionT from "exe-version";

import type { IGame } from "../../../types/IGame";
import { statAsync } from "../../../util/fs";
import lazyRequire from "../../../util/lazyRequire";
import { log } from "../../../util/log";
import { truthy } from "../../../util/util";
import type { IDiscoveryResult } from "../../gamemode_management/types/IDiscoveryResult";

const exeVersion: typeof exeVersionT = lazyRequire(() => require("exe-version"));

export type GameVersionResolver = (game: IGame, discovery: IDiscoveryResult) => Promise<string>;

async function getExtGameVersion(game: IGame, discovery: IDiscoveryResult): Promise<string> {
  return game.getGameVersion(discovery.path, discovery.executable || game.executable());
}

async function getExecGameVersion(game: IGame, discovery: IDiscoveryResult): Promise<string> {
  const exePath = path.join(discovery.path, discovery.executable || game.executable());
  try {
    await statAsync(exePath);
    return exeVersion.default(exePath);
  } catch (err) {
    return "0.0.0";
  }
}

export const resolveGameVersion: GameVersionResolver = async (game, discovery) => {
  if (discovery?.path === undefined || !truthy(game?.executable?.(discovery.path))) {
    throw new ProcessCanceled("Game is not discovered");
  }
  if (game.getGameVersion !== undefined) {
    try {
      const version = await getExtGameVersion(game, discovery);
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
  return getExecGameVersion(game, discovery);
};
