import * as path from "node:path";
import * as queryParser from "querystring";

import { parseError } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import * as winapi from "winapi-bindings";
import { parseStringPromise } from "xml2js";

import { log } from "@/logging";
import { GameEntryNotFound } from "@/types/IGameStore";
import type { IGameStore, IGameStoreSnapshot } from "@/types/IGameStore";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";

const STORE_ID = "origin";
const STORE_NAME = "Origin";
const STORE_PRIORITY = 50;
const MANIFEST_EXT = "mfst";

const INSTALLER_DATA = path.join("__Installer", "installerdata.xml");
const ORIGIN_DATAPATH = "c:\\ProgramData\\Origin\\";

export class MissingXMLElementError extends Error {
  private mElementName: string;
  constructor(elementName: string) {
    super("Missing XML element");
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.mElementName = elementName;
  }

  public get elementName() {
    return this.mElementName;
  }
}

// 3rd party game companies seem to generate their game
//  "DiP" manifest using a tool called EAInstaller, this
//  is the function we should be using _first_ when querying
//  the game's name as most games would be developed by non-EA
//  companies.
export declare type ManifestType = "DiPManifest" | "default";

export class OriginLauncher implements IGameStore {
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;

  #clientPath: string | undefined;
  #snapshot: IGameStoreSnapshot;

  constructor() {
    if (process.platform === "win32") {
      try {
        const clientPath = winapi.RegGetValue(
          "HKEY_LOCAL_MACHINE",
          "SOFTWARE\\WOW6432Node\\Origin",
          "ClientPath",
        );
        this.#clientPath = clientPath.value as string;
        this.#snapshot = { entries: [], isInstalled: true };
      } catch (err) {
        log("info", "Origin launcher not found", { err });
        this.#clientPath = undefined;
        this.#snapshot = { entries: [], isInstalled: false };
      }
    } else {
      this.#clientPath = undefined;
      this.#snapshot = { entries: [], isInstalled: false };
    }
  }

  public static create(): OriginLauncher | undefined {
    if (process.platform === "win32") return new OriginLauncher();
    return undefined;
  }

  public async launchGame(appId: string): Promise<void> {
    const posPath = await this.getPosixPath(appId);
    window.api.shell.openUrl(posPath);
  }

  public getPosixPath(name: string): Promise<string> {
    return Promise.resolve(`origin2://game/launch?offerIds=${name}`);
  }

  public queryPath(): Promise<string | undefined> {
    return Promise.resolve(this.#clientPath);
  }

  public async isGameInstalled(name: string): Promise<boolean> {
    try {
      await this.findByName(name);
      return true;
    } catch {
      return false;
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

  public async findByName(namePattern: string): Promise<IGameStoreEntry> {
    const re = new RegExp("^" + namePattern + "$");
    const entries = await this.allGames();
    const entry = entries.find((entry) => re.test(entry.name));
    if (entry === undefined) {
      throw new GameEntryNotFound(namePattern, STORE_ID);
    }
    return entry;
  }

  public getGameStorePath(): Promise<string | undefined> {
    return Promise.resolve(this.#clientPath);
  }

  public allGames(): Promise<IGameStoreEntry[]> {
    return Promise.resolve(this.#snapshot.entries);
  }

  public snapshot(): IGameStoreSnapshot {
    return this.#snapshot;
  }

  public async reloadGames(): Promise<void> {
    const entries = await this.parseLocalContent();
    this.#snapshot = { entries, isInstalled: this.#snapshot.isInstalled };
  }

  /**
   * Try the DiP manifest first (3rd party games), fall back to the default
   * manifest layout. PromiseBB.any used to race the two; sequential probing
   * keeps the same outcome without the aggregate error.
   */
  private async resolveGameName(installerPath: string): Promise<string> {
    try {
      return await this.getGameName(installerPath, "DiPManifest");
    } catch {
      return this.getGameName(installerPath, "default");
    }
  }

  private async getGameName(installerPath: string, manifestType: ManifestType): Promise<string> {
    const blob = await window.api.fs.readFile(QualifiedPath.fromNative(installerPath));
    const installerData = new TextDecoder().decode(blob);

    const xmlDoc = await parseStringPromise(installerData);

    const elements =
      manifestType === "default"
        ? xmlDoc.game.metadata.localeInfo
        : xmlDoc.DiPManifest.gameTitles[0].gameTitle;

    for (const element of elements) {
      if (element.$.locale === "en_US") {
        return manifestType === "default" ? element.title : element._;
      }
    }

    throw new MissingXMLElementError("gameTitle(en_US)");
  }

  private async parseLocalContent(): Promise<IGameStoreEntry[]> {
    const localData = path.join(ORIGIN_DATAPATH, "LocalContent");

    try {
      const iterator = await window.api.fs.enumerateDirectory(QualifiedPath.fromNative(localData), {
        types: "files",
        recursive: true,
      });

      const entries: IGameStoreEntry[] = [];
      for await (const entry of iterator) {
        if (entry.extension !== MANIFEST_EXT) continue;

        const game = await this.parseManifest(entry);
        if (game !== undefined) {
          entries.push(game);
        }
      }

      return entries;
    } catch (err) {
      // not-found probably just means origin is not installed
      if (parseError(err).data.kind !== "fs:not-found") {
        log("error", "failed to read origin directory", { err });
      }
      return [];
    }
  }

  /**
   * Turn a single .mfst manifest into a game entry. Returns undefined when the
   * manifest is malformed or the game does not appear to be installed; a
   * manifest that cannot be read propagates, which skips the rest of the scan.
   */
  private async parseManifest(entry: QualifiedPath): Promise<IGameStoreEntry | undefined> {
    const blob = await window.api.fs.readFile(entry);
    const data = new TextDecoder().decode(blob);

    let query;
    try {
      // Ignore the preceding '?'
      query = queryParser.parse(data.substr(1));
    } catch (err) {
      log("error", "failed to parse manifest file", err);
      return undefined;
    }

    if (!!query.dipinstallpath && !!query.id) {
      // We have the installation path and the game's ID which we can
      //  use to launch the game, but we need the game's name as well.
      const gamePath = query.dipinstallpath as string;
      const appid = query.id as string;
      const installerFilepath = path.join(gamePath, INSTALLER_DATA);

      // Uninstalling Origin games does NOT remove manifest files, we need
      //  to ensure that the installer data file exists before we do anything.
      try {
        const status = await window.api.fs.stat(QualifiedPath.fromNative(installerFilepath));
        if (!status.exists) {
          // Game does not appear to be installed...
          log("debug", "Origin game manifest found, but does not appear to be installed", {
            appid,
          });
          return undefined;
        }

        const name = await this.resolveGameName(installerFilepath);
        // We found the name.
        const launcherEntry: IGameStoreEntry = {
          name,
          appid,
          gamePath,
          gameStoreId: STORE_ID,
        };
        return launcherEntry;
      } catch (err) {
        if (parseError(err).data.kind === "fs:not-found") {
          // Game does not appear to be installed...
          log("debug", "Origin game manifest found, but does not appear to be installed", { err });
        } else {
          log("error", `failed to find game name for ${appid}`, { err });
        }
        return undefined;
      }
    }

    return undefined;
  }
}
