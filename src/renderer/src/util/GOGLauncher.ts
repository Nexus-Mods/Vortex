import * as path from "node:path";

import { getErrorCode, unknownToError } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import * as winapi from "winapi-bindings";

import { log } from "@/logging";
import type { IExtensionApi } from "@/types/api";
import type { IExecInfo } from "@/types/IExecInfo";
import type { IGameStore, IGameStoreSnapshot } from "@/types/IGameStore";
import { GameEntryNotFound } from "@/types/IGameStore";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";

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
  #clientPath: string | undefined;
  #snapshot: IGameStoreSnapshot;

  constructor() {
    if (process.platform === "win32") {
      try {
        const gogPath = winapi.RegGetValue(
          "HKEY_LOCAL_MACHINE",
          "SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient\\paths",
          "client",
        );
        this.#clientPath = gogPath.value as string;
        this.#snapshot = { entries: [], isInstalled: true };
      } catch (err) {
        log("info", "gog not found", { err });
        this.#clientPath = undefined;
        this.#snapshot = { entries: [], isInstalled: false };
      }
    } else {
      log("info", "gog not found", {
        error: "only available on Windows systems",
      });
      this.#clientPath = undefined;
      this.#snapshot = { entries: [], isInstalled: false };
    }
  }

  public static create(): GoGLauncher | undefined {
    if (process.platform === "win32") return new GoGLauncher();
    return undefined;
  }

  /**
   * find the first game that matches the specified name pattern
   */
  public async findByName(namePattern: string): Promise<IGameStoreEntry> {
    const re = new RegExp("^" + namePattern + "$");
    const entries = await this.allGames();
    const entry = entries.find((entry) => re.test(entry.name));
    if (entry === undefined) {
      throw new GameEntryNotFound(namePattern, STORE_ID);
    }
    return entry;
  }

  public async launchGame(appInfo: any, api?: IExtensionApi): Promise<void> {
    const execInfo = await this.getExecInfo(appInfo);

    // TODO: Bluebird to native
    await Promise.resolve(
      api.runExecutable(execInfo.execPath, execInfo.arguments, {
        cwd: path.dirname(execInfo.execPath),
        suggestDeploy: true,
        shell: true,
      }),
    );
  }

  public async getExecInfo(appId: string): Promise<IExecInfo> {
    const entries = await this.allGames();
    const gameEntry = entries.find((entry) => entry.appid === appId);
    if (gameEntry === undefined) {
      throw new GameEntryNotFound(appId, STORE_ID);
    }

    return {
      execPath: path.join(this.#clientPath, GOG_EXEC),
      arguments: ["/command=runGame", `/gameId=${gameEntry.appid}`, `path="${gameEntry.gamePath}"`],
    };
  }

  /**
   * find the first game with the specified appid or one of the specified appids
   */
  public async findByAppId(appId: string | string[]): Promise<IGameStoreEntry> {
    const matcher = Array.isArray(appId)
      ? (entry: IGameStoreEntry) => appId.includes(entry.appid)
      : (entry: IGameStoreEntry) => appId === entry.appid;

    const entries = await this.allGames();
    const gameEntry = entries.find(matcher);
    if (gameEntry === undefined) {
      throw new GameEntryNotFound(Array.isArray(appId) ? appId.join(", ") : appId, STORE_ID);
    }
    return gameEntry;
  }

  public allGames(): Promise<IGameStoreEntry[]> {
    return Promise.resolve(this.#snapshot.entries);
  }

  public snapshot(): IGameStoreSnapshot {
    return this.#snapshot;
  }

  public async reloadGames(): Promise<void> {
    const entries = await this.getGameEntries();
    this.#snapshot = { entries, isInstalled: this.#snapshot.isInstalled };
  }

  public getGameStorePath(): Promise<string | undefined> {
    return Promise.resolve(
      this.#clientPath === undefined ? undefined : path.join(this.#clientPath, "GalaxyClient.exe"),
    );
  }

  public async identifyGame(
    gamePath: string,
    fallback: (gamePath: string) => PromiseLike<boolean>,
  ): Promise<boolean> {
    const [custom, fallbackResult] = await Promise.all([
      window.api.fs
        .stat(QualifiedPath.fromNative(gamePath).join("gog.ico"))
        .then((status) => status.exists),
      fallback(gamePath),
    ]);

    if (custom !== fallbackResult) {
      log("warn", "(gog) game identification inconclusive", {
        gamePath,
        custom,
        fallback: fallbackResult,
      });
    }

    return custom || fallbackResult;
  }

  private getGameEntries(): Promise<IGameStoreEntry[]> {
    if (this.#clientPath === undefined) {
      return Promise.resolve<IGameStoreEntry[]>([]);
    }

    return new Promise<IGameStoreEntry[]>((resolve, reject) => {
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
        return getErrorCode(err) === "ENOENT" ? resolve([]) : reject(unknownToError(err));
      }
    });
  }
}
