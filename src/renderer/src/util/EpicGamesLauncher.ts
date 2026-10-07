import * as path from "node:path";

import { parseError } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import * as winapi from "winapi-bindings";
import { z } from "zod";

import { log } from "../logging";
import type { IExtensionApi } from "../types/IExtensionContext";
import type { IGameStore, IGameStoreSnapshot } from "../types/IGameStore";
import { GameEntryNotFound } from "../types/IGameStore";
import type { IGameStoreEntry } from "../types/IGameStoreEntry";

const ITEM_EXT = "item";
const STORE_ID = "epic";
const STORE_NAME = "Epic Games Launcher";
const STORE_PRIORITY = 60;

/**
 * Epic Store launcher seems to be holding game information inside
 *  .item manifest files which are stored inside the launchers Data folder
 *  "(C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests" by default
 */
export class EpicGamesLauncher implements IGameStore {
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;

  #dataPath: string | undefined;
  #launcherExecPath: string | undefined;
  #snapshot: IGameStoreSnapshot;

  constructor() {
    if (process.platform === "win32") {
      try {
        // We find the launcher's dataPath
        const epicDataPath = winapi.RegGetValue(
          "HKEY_LOCAL_MACHINE",
          "SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher",
          "AppDataPath",
        );

        this.#dataPath = epicDataPath.value as string;
        this.#snapshot = { entries: [], isInstalled: true };
      } catch (err) {
        log("info", "Epic games launcher not found", err);
        this.#dataPath = undefined;
        this.#snapshot = { entries: [], isInstalled: false };
      }
    } else {
      this.#dataPath = undefined;
      this.#snapshot = { entries: [], isInstalled: false };
    }
  }

  public async launchGame(appInfo: any, api?: IExtensionApi): Promise<void> {
    const appId =
      typeof appInfo === "object" && "appId" in appInfo ? appInfo.appId : appInfo.toString();

    const posPath = await this.getPosixPath(appId);
    window.api.shell.openUrl(posPath);
  }

  public launchGameStore(api: IExtensionApi, parameters?: string[]): Promise<void> {
    const launchCommand = "com.epicgames.launcher://start";
    window.api.shell.openUrl(launchCommand);
    return Promise.resolve();
  }

  public getPosixPath(name: string): Promise<string> {
    return Promise.resolve(`com.epicgames.launcher://apps/${name}?action=launch&silent=true`);
  }

  public queryPath(): Promise<string> {
    return Promise.resolve(path.join(this.#dataPath, this.executable()));
  }

  /**
   * test if a game is installed through the launcher.
   * Please keep in mind that epic seems to internally give third-party games animal names. Kinky.
   * @param name
   */
  public async isGameInstalled(name: string): Promise<boolean> {
    try {
      await this.findByAppId(name);
      return true;
    } catch {
      try {
        await this.findByName(name);
        return true;
      } catch {
        return false;
      }
    }
  }

  public async findByAppId(appId: string | string[]): Promise<IGameStoreEntry> {
    const matcher = Array.isArray(appId)
      ? (entry: IGameStoreEntry) => appId.includes(entry.appid)
      : (entry: IGameStoreEntry) => appId === entry.appid;

    const entries = await this.allGames();
    const entry = entries.find(matcher);
    if (entry === undefined) {
      throw new GameEntryNotFound(Array.isArray(appId) ? appId.join(", ") : appId, STORE_ID);
    }

    return entry;
  }

  /**
   * Try to find the epic entry object using Epic's internal naming convention.
   *  e.g. "Flour" === "Untitled Goose Game" lol
   * @param name
   */
  public async findByName(name: string): Promise<IGameStoreEntry> {
    const re = new RegExp("^" + name + "$");
    const entries = await this.allGames();
    const entry = entries.find((entry) => re.test(entry.name));
    if (entry === undefined) {
      throw new GameEntryNotFound(name, STORE_ID);
    }
    return entry;
  }

  public allGames(): Promise<EpicGamesStoreEntry[]> {
    return Promise.resolve(this.#snapshot.entries as EpicGamesStoreEntry[]);
  }

  public snapshot(): IGameStoreSnapshot {
    return this.#snapshot;
  }

  public async reloadGames(): Promise<void> {
    const entries = await this.parseManifests();
    this.#snapshot = { entries, isInstalled: this.#snapshot.isInstalled };
  }

  public getGameStorePath(): Promise<string | undefined> {
    if (this.#launcherExecPath) {
      return Promise.resolve(this.#launcherExecPath);
    }

    try {
      const epicLauncher = winapi.RegGetValue(
        "HKEY_LOCAL_MACHINE",
        "SOFTWARE\\Classes\\com.epicgames.launcher\\DefaultIcon",
        "(Default)",
      );

      const val = epicLauncher.value;
      this.#launcherExecPath = val.toString().split(",")[0];
      return Promise.resolve(this.#launcherExecPath);
    } catch (err) {
      log("info", "Epic games launcher not found", err);
      return Promise.resolve(undefined);
    }
  }

  private executable() {
    // TODO: This probably won't work on *nix, test and fix.
    return process.platform === "win32" ? "EpicGamesLauncher.exe" : "EpicGamesLauncher";
  }

  private async parseManifests(): Promise<EpicGamesStoreEntry[]> {
    try {
      if (this.#dataPath === undefined) return [];

      const manifestsLocation = QualifiedPath.fromNative(this.#dataPath).join("Manifests");

      let iterator: AsyncIterableIterator<QualifiedPath, undefined>;

      try {
        iterator = await window.api.fs.enumerateDirectory(manifestsLocation);
      } catch (err) {
        if (parseError(err).data.kind === "fs:not-found") {
          log("info", "Epic launcher manifests could not be found");
          return [];
        }

        throw err;
      }

      const games: EpicGamesStoreEntry[] = [];
      for await (const entry of iterator) {
        if (entry.extension !== ITEM_EXT) continue;

        let data: string;
        try {
          const blob = await window.api.fs.readFile(entry);
          data = new TextDecoder().decode(blob);
        } catch (err) {
          log("error", "Cannot read EGS manifest", { err, entry });
          continue;
        }

        try {
          const result = manifestSchema.safeParse(data);
          if (result.error) {
            log("warn", "Failed to parse EGS manifest", { entry, error: result.error });
            continue;
          }

          const parsed = result.data;

          // Epic does not seem to clean old manifests. We need
          //  to stat the executable for each item to ensure that the
          //  game entry is actually valid.
          try {
            const status = await window.api.fs.stat(
              QualifiedPath.fromNative(parsed.InstallLocation).join(parsed.LaunchExecutable),
            );
            if (!status.exists) continue;
          } catch {
            continue;
          }

          const storeEntry: EpicGamesStoreEntry = {
            gameStoreId: STORE_ID,
            name: parsed.DisplayName,
            appid: parsed.AppName,
            catalogItemId: parsed.CatalogItemId,
            catalogNamespace: parsed.CatalogNamespace,
            gamePath: parsed.InstallLocation,
          };

          games.push(storeEntry);
        } catch (err) {
          log("error", "Cannot parse Epic Games manifest", { err, entry });
          continue;
        }
      }

      return games;
    } catch (err) {
      log("error", "Failed to parse Epic Games manifests", err);
      return [];
    }
  }
}

export interface EpicGamesStoreEntry extends IGameStoreEntry {
  catalogItemId: string;
  catalogNamespace: string;
}

const manifestSchema = z.looseObject({
  LaunchExecutable: z.string(),
  InstallLocation: z.string(),
  DisplayName: z.string(),
  AppName: z.string(),
  CatalogItemId: z.string(),
  CatalogNamespace: z.string(),
});

const instance: IGameStore | undefined =
  process.platform === "win32" ? new EpicGamesLauncher() : undefined;

export default instance;
