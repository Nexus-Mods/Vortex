import * as path from "node:path";

import { getErrorCode, unknownToError } from "@vortex/shared";
import * as winapi from "winapi-bindings";

import { log } from "@/logging";
import type { IExtensionApi } from "@/types/api";
import type { IGameStore, IGameStoreSnapshot } from "@/types/IGameStore";
import { GameEntryNotFound } from "@/types/IGameStore";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";

const STORE_ID = "uplay";
const STORE_NAME = "Uplay";
const STORE_PRIORITY = 55;
const UPLAY_EXEC = "Uplay.exe";
const REG_UPLAY_INSTALLS = "SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs";
const REG_UPLAY_NAME_LOCATION =
  "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Uplay Install ";

/**
 * base class to interact with local Uplay game store.
 * @class UPlayLauncher
 */
export class UPlayLauncher implements IGameStore {
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;
  #clientPath: string | undefined;
  #snapshot: IGameStoreSnapshot;

  constructor() {
    if (process.platform === "win32") {
      // No Windows, no uplay launcher!
      try {
        const uplayPath = winapi.RegGetValue(
          "HKEY_LOCAL_MACHINE",
          "SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher",
          "InstallDir",
        );
        this.#clientPath = path.join(uplayPath.value as string, UPLAY_EXEC);
        this.#snapshot = { entries: [], isInstalled: true };
      } catch (err) {
        log("info", "uplay launcher not found", { err });
        this.#clientPath = undefined;
        this.#snapshot = { entries: [], isInstalled: false };
      }
    } else {
      log("info", "uplay launcher not found", {
        error: "only available on Windows systems",
      });
      this.#clientPath = undefined;
      this.#snapshot = { entries: [], isInstalled: false };
    }
  }

  public static create(): UPlayLauncher | undefined {
    if (process.platform === "win32") return new UPlayLauncher();
    return undefined;
  }

  // It seems that the appId's the launcher is storing in registry are
  //  different from the ids uplay is using to launch the game..
  //  for example - Assassin's Creed Black Flag is stored as '273' in registry
  //  but the posix path used to launch the game uses '619'
  public async launchGame(appInfo: any, api?: IExtensionApi): Promise<void> {
    const posPath = await this.getPosixPath(appInfo);
    window.api.shell.openUrl(posPath);
  }

  // To note: UPlay can launch multiple executables for a game.
  //  The way they differentiate between executables is using the appended
  //  digit at the end of the posix path.
  //  e.g. 'uplay://launch/619/0' will launch Assassin's Creed Black Flag (Singleplayer)
  //  while 'uplay://launch/619/1' will launch Assassin's Creed Black Flag (Multiplayer)
  //  '0' seems to be the default value reason why we simply hard code it; we may
  //  need to change this in the future to allow game extensions to choose the executable
  //  they want to launch.
  public getPosixPath(appId: string): Promise<string> {
    return Promise.resolve(`uplay://launch/${appId}/0`);
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

  public async findByName(appName: string): Promise<IGameStoreEntry> {
    const re = new RegExp("^" + appName + "$");
    const entries = await this.allGames();
    const entry = entries.find((entry) => re.test(entry.name));
    if (entry === undefined) {
      throw new GameEntryNotFound(appName, STORE_ID);
    }
    return entry;
  }

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

  public getGameStorePath(): Promise<string | undefined> {
    return Promise.resolve(
      this.#clientPath === undefined ? undefined : path.join(this.#clientPath, UPLAY_EXEC),
    );
  }

  private getGameEntries(): Promise<IGameStoreEntry[]> {
    if (this.#clientPath === undefined) {
      // Can't find the client? don't continue.
      return Promise.resolve<IGameStoreEntry[]>([]);
    }

    return new Promise<IGameStoreEntry[]>((resolve, reject) => {
      try {
        winapi.WithRegOpen("HKEY_LOCAL_MACHINE", REG_UPLAY_INSTALLS, (hkey) => {
          const keys = winapi.RegEnumKeys(hkey);
          const gameEntries: IGameStoreEntry[] = keys.map((key) => {
            try {
              const gameEntry: IGameStoreEntry = {
                appid: key.key,
                gamePath: winapi.RegGetValue(hkey, key.key, "InstallDir").value as string,
                // Unfortunately the name of this game is stored elsewhere.
                name: winapi.RegGetValue(
                  "HKEY_LOCAL_MACHINE",
                  REG_UPLAY_NAME_LOCATION + key.key,
                  "DisplayName",
                ).value as string,
                gameStoreId: STORE_ID,
              };
              return gameEntry;
            } catch (err) {
              log("info", "gamestore-uplay: registry query failed", { key: key.key, err });
              return undefined;
            }
          });
          return resolve(gameEntries.filter((entry) => !!entry));
        });
      } catch (err) {
        return getErrorCode(err) === "ENOENT" ? resolve([]) : reject(unknownToError(err));
      }
    });
  }
}
