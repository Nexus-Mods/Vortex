import * as path from "node:path";

import { getErrorCode } from "@vortex/shared";
import Bluebird from "bluebird";
import * as winapi from "winapi-bindings";

import type { IExtensionApi } from "@/types/api";
import type { IExecInfo } from "@/types/IExecInfo";
import { GameEntryNotFound } from "@/types/IGameStore";
import type { IGameStore } from "@/types/IGameStore";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";

import { log } from "../logging";
import { statAsync } from "./fs";

const STORE_ID = "gog";
const STORE_NAME = "GOG";
const STORE_PRIORITY = 15;

const GOG_EXEC = "GalaxyClient.exe";

const REG_GOG_GAMES = "SOFTWARE\\WOW6432Node\\GOG.com\\Games";

/**
 * base class to interact with local GoG Galaxy client
 */
export class GoGLauncher implements IGameStore {
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;
  private mClientPath: Bluebird<string> | undefined;
  private mCache: Bluebird<IGameStoreEntry[]>;

  constructor() {
    if (process.platform === "win32") {
      try {
        const gogPath = winapi.RegGetValue(
          "HKEY_LOCAL_MACHINE",
          "SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient\\paths",
          "client",
        );
        this.mClientPath = Bluebird.resolve(gogPath.value as string);
      } catch (err) {
        log("info", "gog not found", { err });
        this.mClientPath = undefined;
      }
    } else {
      log("info", "gog not found", {
        error: "only available on Windows systems",
      });
      this.mClientPath = undefined;
    }
  }

  public static create(): GoGLauncher | undefined {
    if (process.platform === "win32") return new GoGLauncher();
    return undefined;
  }

  /**
   * find the first game that matches the specified name pattern
   */
  public findByName(namePattern: string): Bluebird<IGameStoreEntry> {
    const re = new RegExp("^" + namePattern + "$");
    return this.allGames()
      .then((entries) => entries.find((entry) => re.test(entry.name)))
      .then((entry) => {
        if (entry === undefined) {
          return Bluebird.reject(new GameEntryNotFound(namePattern, STORE_ID));
        } else {
          return Bluebird.resolve(entry);
        }
      });
  }

  public launchGame(appInfo: any, api?: IExtensionApi): Bluebird<void> {
    return this.getExecInfo(appInfo).then((execInfo) =>
      api.runExecutable(execInfo.execPath, execInfo.arguments, {
        cwd: path.dirname(execInfo.execPath),
        suggestDeploy: true,
        shell: true,
      }),
    );
  }

  public getExecInfo(appId: string): Bluebird<IExecInfo> {
    return this.allGames().then((entries) => {
      const gameEntry = entries.find((entry) => entry.appid === appId);
      return gameEntry === undefined
        ? Bluebird.reject(new GameEntryNotFound(appId, STORE_ID))
        : this.mClientPath.then((basePath) => {
            const gogClientExec = {
              execPath: path.join(basePath, GOG_EXEC),
              arguments: [
                "/command=runGame",
                `/gameId=${gameEntry.appid}`,
                `path="${gameEntry.gamePath}"`,
              ],
            };

            return Bluebird.resolve(gogClientExec);
          });
    });
  }

  /**
   * find the first game with the specified appid or one of the specified appids
   */
  public findByAppId(appId: string | string[]): Bluebird<IGameStoreEntry> {
    const matcher = Array.isArray(appId)
      ? (entry: IGameStoreEntry) => appId.includes(entry.appid)
      : (entry: IGameStoreEntry) => appId === entry.appid;

    return this.allGames().then((entries) => {
      const gameEntry = entries.find(matcher);
      if (gameEntry === undefined) {
        return Bluebird.reject(
          new GameEntryNotFound(Array.isArray(appId) ? appId.join(", ") : appId, STORE_ID),
        );
      } else {
        return Bluebird.resolve(gameEntry);
      }
    });
  }

  public allGames(): Bluebird<IGameStoreEntry[]> {
    if (!this.mCache) {
      this.mCache = this.getGameEntries();
    }
    return this.mCache;
  }

  public reloadGames(): Bluebird<void> {
    return new Bluebird((resolve) => {
      this.mCache = this.getGameEntries();
      return resolve();
    });
  }

  public getGameStorePath(): Bluebird<string> {
    return !!this.mClientPath
      ? this.mClientPath.then((basePath) =>
          Bluebird.resolve(path.join(basePath, "GalaxyClient.exe")),
        )
      : Bluebird.resolve(undefined);
  }

  public identifyGame(
    gamePath: string,
    fallback: (gamePath: string) => PromiseLike<boolean>,
  ): Bluebird<boolean> {
    return Bluebird.all([this.fileExists(path.join(gamePath, "gog.ico")), fallback(gamePath)]).then(
      ([custom, fallback]) => {
        if (custom !== fallback) {
          log("warn", "(gog) game identification inconclusive", {
            gamePath,
            custom,
            fallback,
          });
        }
        return custom || fallback;
      },
    );
  }

  private fileExists(filePath: string): PromiseLike<boolean> {
    return statAsync(filePath)
      .then(() => true)
      .catch(() => false);
  }

  private getGameEntries(): Bluebird<IGameStoreEntry[]> {
    return !!this.mClientPath
      ? new Bluebird<IGameStoreEntry[]>((resolve, reject) => {
          try {
            winapi.WithRegOpen("HKEY_LOCAL_MACHINE", REG_GOG_GAMES, (hkey) => {
              const keys = winapi.RegEnumKeys(hkey);
              const gameEntries: IGameStoreEntry[] = keys
                .map((key) => {
                  try {
                    const gameEntry: IGameStoreEntry = {
                      appid: winapi.RegGetValue(hkey, key.key, "gameID").value as string,
                      gamePath: winapi.RegGetValue(hkey, key.key, "path").value as string,
                      name: winapi.RegGetValue(hkey, key.key, "startMenu").value as string,
                      gameStoreId: STORE_ID,
                    };
                    return gameEntry;
                  } catch (err) {
                    log("error", "gamestore-gog: failed to create game entry", err);
                    // Don't stop, keep going.
                    return undefined;
                  }
                })
                .filter((entry) => !!entry);
              return resolve(gameEntries);
            });
          } catch (err) {
            return getErrorCode(err) === "ENOENT" ? resolve([]) : reject(err);
          }
        })
      : Bluebird.resolve<IGameStoreEntry[]>([]);
  }
}
