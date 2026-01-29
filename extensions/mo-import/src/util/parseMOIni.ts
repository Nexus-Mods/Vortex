import Promise from "bluebird";
import * as path from "path";
import { log, types, util } from "vortex-api";
import IniParser, { IniFile, WinapiFormat } from "vortex-parse-ini";

interface IIniSpec {
  General: {
    game: string;
    gameName: string;
    gamePath: string;
  };
  Settings: {
    base_directory: string;
    download_directory: string;
    mod_directory: string;
    cache_directory: string;
  };
}

export interface IMOConfig {
  game: string;
  downloadPath: string;
  modPath: string;
}

const parser = new IniParser(new WinapiFormat());

function determineGame(
  games: { [gameId: string]: types.IDiscoveryResult },
  gameName: string,
  gamePath: string,
  normalize: (input: string) => string,
): string {
  if (gameName !== undefined) {
    switch (gameName) {
      case "Fallout 3":
        return "fallout3";
      case "Fallout 4":
        return "fallout4";
      default:
        return gameName.toLowerCase();
    }
  }

  if (gamePath !== undefined) {
    const gameId = Object.keys(games).find((iterId) => {
      if (games[iterId].path === undefined) {
        return;
      }
      return normalize(games[iterId].path) === normalize(gamePath);
    });
    if (gameId !== undefined) {
      return gameId;
    } else {
      return path.basename(gamePath).toLowerCase();
    }
  }

  throw new Error("can't determine game type");
}

function parseMOIni(
  games: { [gameId: string]: types.IDiscoveryResult },
  basePath: string,
): Promise<IMOConfig> {
  let normalize: (input: string) => string;
  return util
    .getNormalizeFunc(basePath)
    .then((normalizeFunc) => {
      normalize = normalizeFunc;
      return parser.read(path.join(basePath, "ModOrganizer.ini"));
    })
    .then((file: IniFile<IIniSpec>) => {
      if (Object.keys(file.data).length === 0) {
        return Promise.reject(
          new Error(
            "This doesn't look like a portable MO install, " +
              "please check in the instances to the left.",
          ),
        );
      }
      let dataBasePath = basePath;
      try {
        if (file.data.Settings.base_directory) {
          dataBasePath = file.data.Settings.base_directory;
        }
      } catch (err) {
        // nop
      }
      let downloadPath = path.join(dataBasePath, "downloads");
      let modPath = path.join(dataBasePath, "mods");
      try {
        if (file.data.Settings.download_directory) {
          downloadPath = file.data.Settings.download_directory;
        }
      } catch (err) {
        // nop
      }
      try {
        if (file.data.Settings.mod_directory) {
          modPath = file.data.Settings.mod_directory;
        }
      } catch (err) {
        // nop
      }
      try {
        return Promise.resolve({
          game: determineGame(
            games,
            file.data.General.gameName,
            file.data.General.gamePath,
            normalize,
          ),
          downloadPath,
          modPath,
        });
      } catch (err) {
        return Promise.reject(err);
      }
    })
    .catch((err) => {
      log("warn", "invalid mo inifile", { err: err.message });
      return Promise.reject(err);
    });
}

export default parseMOIni;
