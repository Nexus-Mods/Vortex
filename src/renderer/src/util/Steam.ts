import PromiseBB from "bluebird";

import * as fs from "./fs";
import { log } from "./log";
import { getSafeCI } from "./storeHelper";

import * as fsOG from "fs/promises";
import * as path from "path";
import { parse } from "simple-vdf";
import * as winapi from "winapi-bindings";
import type {
  ICustomExecutionInfo,
  IExecInfo,
  IGameStore,
  IGameStoreEntry,
} from "../types/api";

import opn from "./opn";

import type { IExtensionApi } from "../types/IExtensionContext";
import { GameEntryNotFound } from "../types/IGameStore";
import getVortexPath from "./getVortexPath";
import { getErrorMessageOrDefault } from "@vortex/shared";
import { findLinuxSteamPath } from "./linux/steamPaths";
import {
  getProtonInfo,
  buildProtonEnvironment,
  buildProtonCommand,
} from "./linux/proton";

const STORE_ID = "steam";
const STORE_NAME = "Steam";
const STEAM_EXEC = process.platform === "win32" ? "Steam.exe" : "steam.sh";
const STORE_PRIORITY = 40;

export interface ISteamEntry extends IGameStoreEntry {
  manifestData?: any;
  usesProton?: boolean;
  compatDataPath?: string;
  protonPath?: string;
}

/// obsolete, no longer used. But it's exported through the api
export class GameNotFound extends Error {
  private mSearch;
  constructor(search: string) {
    super("Not in Steam library");
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.mSearch = search;
  }
  public get search() {
    return this.mSearch;
  }
}

/**
 * base class to interact with local steam installation
 * @class Steam
 */
class Steam implements IGameStore {
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;
  private mBaseFolder: PromiseBB<string | undefined>;
  private mCache: PromiseBB<ISteamEntry[]>;

  constructor() {
    if (process.platform === "win32") {
      // windows
      try {
        const steamPath = winapi.RegGetValue(
          "HKEY_CURRENT_USER",
          "Software\\Valve\\Steam",
          "SteamPath",
        );
        this.mBaseFolder = PromiseBB.resolve(steamPath.value as string);
      } catch (err) {
        log("info", "steam not found", err);
        this.mBaseFolder = PromiseBB.resolve(undefined);
      }
    } else {
      const linuxPath = findLinuxSteamPath();
      this.mBaseFolder = PromiseBB.resolve(linuxPath);
    }
  }

  /**
   * find the first game that matches the specified name pattern
   */
  public findByName(namePattern: string): PromiseBB<ISteamEntry> {
    const re = new RegExp("^" + namePattern + "$");
    return this.allGames()
      .then((entries) => entries.find((entry) => re.test(entry.name)))
      .then((entry) => {
        if (entry === undefined) {
          return PromiseBB.reject(new GameEntryNotFound(namePattern, STORE_ID));
        } else {
          return PromiseBB.resolve(entry);
        }
      });
  }

  public launchGame(appInfo: any, api?: IExtensionApi): PromiseBB<void> {
    // We expect appInfo to be one of three things at this point:
    //  - The game extension's details object if provided, in which case
    //      we want to extract the steamAppId entry. (preferred case as this
    //      is used by the gameinfo-steam extension as well).
    //  - The steam Id in string form.
    //  - The directory path which contains the game's executable.
    if (
      this.isCustomExecObject(appInfo) &&
      appInfo.launchType === "gamestore"
    ) {
      return this.getPosixPath(appInfo).then((posix) =>
        opn(posix).catch((err) => PromiseBB.resolve()),
      );
    }
    const info = appInfo.steamAppId ? appInfo.steamAppId.toString() : appInfo;
    return this.getExecInfo(info).then((execInfo) =>
      api?.runExecutable(execInfo.execPath, execInfo.arguments, {
        cwd: path.dirname(execInfo.execPath),
        suggestDeploy: true,
        shell: true,
      }),
    );
  }

  public getPosixPath(appInfo: any) {
    const posixCommand = `steam://launch/${appInfo.appId}/${appInfo.parameters.join()}`;
    return PromiseBB.resolve(posixCommand);
  }

  public getExecInfo(appInfo: any): PromiseBB<IExecInfo> {
    // Steam uses numeric values to id games internally; if the provided appId
    //  contains path separators, it's a clear indication that the game
    //  extension did not provide a steam id and the starter info object
    //  provided the game executables dirname instead.
    let appId;
    let parameters: string[] = [];
    if (this.isCustomExecObject(appInfo)) {
      appId = appInfo.appId;
      parameters = appInfo.parameters ?? [];
    } else {
      appId = appInfo.toString();
    }

    const isDirPath = appId.indexOf(path.sep) !== -1;
    return this.allGames().then((entries) => {
      const found = entries.find((entry) =>
        !isDirPath
          ? entry.appid === appId
          : // Checking by gamepath is inefficient but I can't think of a different
            //  way to ascertain whether the launcher has this game entry with the
            //  provided information...
            appId.toLowerCase().indexOf(entry.gamePath.toLowerCase()) !== -1,
      );
      if (found === undefined) {
        return PromiseBB.reject(new GameEntryNotFound(appId, STORE_ID));
      }
      return this.mBaseFolder.then((basePath) => {
        const steamExec = {
          execPath: path.join(basePath!, STEAM_EXEC),
          arguments: ["-applaunch", appId, ...parameters],
        };
        return PromiseBB.resolve(steamExec);
      });
    });
  }

  /**
   * find the first game with the specified appid or one of the specified appids
   */
  public findByAppId(appId: string | string[]): PromiseBB<ISteamEntry> {
    // support searching for one app id or one out of a list (when there are multiple
    // variants of a game)
    const matcher = Array.isArray(appId)
      ? (entry) => appId.indexOf(entry.appid) !== -1
      : (entry) => entry.appid === appId;

    return this.allGames().then((entries) => {
      const entry = entries.find(matcher);
      if (entry === undefined) {
        return PromiseBB.reject(
          new GameEntryNotFound(
            Array.isArray(appId) ? appId.join(", ") : appId,
            STORE_ID,
          ),
        );
      } else {
        return PromiseBB.resolve(entry);
      }
    });
  }

  public allGames(): PromiseBB<ISteamEntry[]> {
    if (!this.mCache) {
      this.mCache = this.parseManifests();
    }
    return this.mCache;
  }

  public getGameStorePath(): PromiseBB<string | undefined> {
    return this.mBaseFolder.then((baseFolder) => {
      if (baseFolder === undefined) {
        return PromiseBB.resolve(undefined);
      }
      return PromiseBB.resolve(path.join(baseFolder, STEAM_EXEC));
    });
  }

  public reloadGames(): PromiseBB<void> {
    return new PromiseBB((resolve) => {
      this.mCache = this.parseManifests();
      return resolve();
    });
  }

  public identifyGame(
    gamePath: string,
    fallback: (gamePath: string) => PromiseLike<boolean>,
  ): PromiseBB<boolean> {
    const custom = gamePath.toLowerCase().split(path.sep).includes("steamapps");

    return PromiseBB.resolve(fallback(gamePath)).then((fbResult: boolean) => {
      if (fbResult !== custom) {
        log("warn", "(steam) game identification inconclusive", {
          gamePath,
          custom,
          fallback,
        });
      }
      return custom || fbResult;
    });
  }

  private isCustomExecObject(object: any): object is ICustomExecutionInfo {
    if (typeof object !== "object") {
      return false;
    }
    return "appId" in object;
  }

  private resolveSteamPaths(): PromiseBB<string[]> {
    log("debug", "resolving Steam game paths");
    return this.mBaseFolder.then((basePath: string) => {
      if (basePath === undefined) {
        // Steam not found/installed
        return PromiseBB.resolve([]);
      }

      const steamPaths: string[] = [basePath];
      return fs
        .readFileAsync(path.resolve(basePath, "config", "libraryfolders.vdf"))
        .then((data: Buffer) => {
          if (data === undefined) {
            return PromiseBB.resolve(steamPaths);
          }
          let parsedObj;
          try {
            parsedObj = parse(data.toString());
          } catch (err) {
            log("warn", "unable to parse steamfolders.vdf", err);
            return PromiseBB.resolve(steamPaths);
          }
          const libObj: any = getSafeCI(parsedObj, ["libraryfolders"], {});
          let counter = libObj.hasOwnProperty("0") ? 0 : 1;
          while (libObj.hasOwnProperty(`${counter}`)) {
            const libPath = libObj[`${counter}`]["path"];
            if (libPath && !steamPaths.includes(libPath)) {
              steamPaths.push(libObj[`${counter}`]["path"]);
            }
            ++counter;
          }
          log("debug", "found steam install folders", { steamPaths });
          return PromiseBB.resolve(steamPaths);
        })
        .catch((err) => {
          // A Steam update has changed the way we resolve the steam library paths
          //  (we used to get these from config.vdf) the libraryfolders.vdf file
          //  appears to at times hold a reference to _all_ library folders; other times
          //  it only holds the path to the alternate steam libraries (the ones that aren't
          //  part of the base Steam installation folder)
          log("warn", "failed to read steam library folders file", err);
          const code = getErrorMessageOrDefault(err);
          return ["EPERM", "ENOENT"].includes(code)
            ? PromiseBB.resolve(steamPaths)
            : PromiseBB.reject(err);
        });
    });
  }

  private parseManifests(): PromiseBB<ISteamEntry[]> {
    return this.resolveSteamPaths().then((steamPaths: string[]) =>
      PromiseBB.mapSeries(steamPaths, (steamPath) => {
        log("debug", "reading steam install folder", { steamPath });
        const steamAppsPath = path.join(steamPath, "steamapps");
        return PromiseBB.resolve(fsOG.readdir(steamAppsPath))
          .then((names) => {
            const filtered = names.filter(
              (name) =>
                name.startsWith("appmanifest_") &&
                path.extname(name) === ".acf",
            );
            log("debug", "got steam manifests", { manifests: filtered });
            return PromiseBB.map(filtered, (name: string) =>
              fs
                .readFileAsync(path.join(steamAppsPath, name))
                .then((manifestData) => ({
                  manifestData,
                  name,
                })),
            );
          })
          .then((appsData) => {
            return appsData
              .map((appData) => {
                const { name, manifestData } = appData;
                try {
                  return { obj: parse(manifestData.toString()), name };
                } catch (err) {
                  log("warn", "failed to parse steam manifest", {
                    name,
                    error: getErrorMessageOrDefault(err),
                  });
                  return undefined;
                }
              })
              .map((res) => {
                if (res === undefined) {
                  return undefined;
                }
                const { obj, name } = res;
                if (
                  obj === undefined ||
                  obj["AppState"] === undefined ||
                  obj["AppState"]["installdir"] === undefined
                ) {
                  log("debug", "invalid appmanifest", name);
                  return undefined;
                }
                try {
                  const result: ISteamEntry = {
                    appid: obj["AppState"]["appid"],
                    gameStoreId: STORE_ID,
                    name: obj["AppState"]["name"],
                    gamePath: path.join(
                      steamAppsPath,
                      "common",
                      obj["AppState"]["installdir"],
                    ),
                    lastUser: obj["AppState"]["LastOwner"],
                    lastUpdated: new Date(
                      obj["AppState"]["LastUpdated"] * 1000,
                    ),
                    manifestData: obj,
                  };
                  return result;
                } catch (err) {
                  log("warn", "failed to parse steam manifest", {
                    name,
                    error: getErrorMessageOrDefault(err),
                  });
                  return undefined;
                }
              })
              .filter((obj): obj is ISteamEntry => !!obj);
          })
          .then((entries: ISteamEntry[]) => {
            // Add Proton info on Linux
            if (process.platform === "win32") {
              return entries;
            }
            return this.mBaseFolder.then((basePath) =>
              PromiseBB.map(entries, async (entry) => {
                try {
                  const protonInfo = await getProtonInfo(
                    basePath,
                    steamAppsPath,
                    entry.appid,
                  );
                  entry.usesProton = protonInfo.usesProton;
                  entry.compatDataPath = protonInfo.compatDataPath;
                  entry.protonPath = protonInfo.protonPath;
                } catch (err) {
                  log("debug", "Could not get Proton info for game", {
                    appid: entry.appid,
                    error: getErrorMessageOrDefault(err),
                  });
                }
                return entry;
              }),
            );
          })
          .catch({ code: "ENOENT" }, (err: any) => {
            // no biggy, this can happen for example if the steam library is on a removable medium
            // which is currently removed
            log("info", "Steam library not found", {
              error: getErrorMessageOrDefault(err),
            });
            return [];
          })
          .catch((err) => {
            log("warn", "Failed to read steam library", {
              path: steamPath,
              error: getErrorMessageOrDefault(err),
            });
            return [];
          });
      })
        .then((games) =>
          games.reduce(
            (prev, current) => (current ? prev.concat(current) : prev),
            [],
          ),
        )
        .tap(() => {
          log("info", "done reading steam libraries");
        }),
    );
  }

  /**
   * Run a Windows tool through Proton using the game's prefix
   */
  public async runToolWithProton(
    api: IExtensionApi,
    exePath: string,
    args: string[],
    options: any,
    gameEntry: ISteamEntry,
  ): Promise<void> {
    if (
      !gameEntry.usesProton ||
      !gameEntry.protonPath ||
      !gameEntry.compatDataPath
    ) {
      return api.runExecutable(exePath, args, options);
    }

    const steamPath = await this.mBaseFolder;
    const { executable, args: protonArgs } = buildProtonCommand(
      gameEntry.protonPath,
      exePath,
      args,
    );
    const protonEnv = buildProtonEnvironment(
      gameEntry.compatDataPath,
      steamPath,
      options.env,
    );

    return api.runExecutable(executable, protonArgs, {
      ...options,
      env: protonEnv,
      shell: false,
    });
  }
}

const instance: Steam = new Steam();

export default instance;

export { Steam };
