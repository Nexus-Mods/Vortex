import parseMOIni from "./parseMOIni";

import Promise from "bluebird";
import * as path from "path";
import { fs, types } from "vortex-api";

export function instancesPath(): string {
  return path.resolve(process.env["LOCALAPPDATA"], "ModOrganizer");
}

export function convertGameId(input: string): string {
  if (input === "skyrimse") {
    return "skyrim special edition";
  } else if (input === "falloutnv") {
    return "new vegas";
  } else {
    return input;
  }
}

function findInstances(
  games: { [gameId: string]: types.IDiscoveryResult },
  gameId: string,
): Promise<string[]> {
  const base = instancesPath();
  return fs
    .readdirAsync(base)
    .filter((fileName: string) =>
      fs
        .statAsync(path.join(base, fileName))
        .then((stat) => stat.isDirectory())
        .catch((err) =>
          ["EACCES", "EPERM"].indexOf(err.code) !== -1
            ? Promise.resolve(false)
            : Promise.reject(err),
        ),
    )
    .filter((dirName: string) =>
      parseMOIni(games, path.join(base, dirName))
        .then((moConfig) => moConfig.game === convertGameId(gameId))
        .catch((err) => false),
    )
    .then((instances: string[]) => instances)
    .catch((err) => {
      if (err.code === "ENOENT") {
        return [];
      } else {
        return Promise.reject(err);
      }
    });
}

export default findInstances;
