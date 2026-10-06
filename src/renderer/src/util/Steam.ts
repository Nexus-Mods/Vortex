import * as path from "node:path";

import { parseError } from "@vortex/shared";
import { QualifiedPath } from "@vortex/shared/filesystem";
import { parse, type VDFObject, type VDFValue } from "simple-vdf";
import * as winapi from "winapi-bindings";

import { log } from "@/logging";

import type { IExecInfo } from "../types/IExecInfo";
import type { IExtensionApi } from "../types/IExtensionContext";
import type { ICustomExecutionInfo, IGameStore, IGameStoreSnapshot } from "../types/IGameStore";
import { GameEntryNotFound } from "../types/IGameStore";
import type { IGameStoreEntry } from "../types/IGameStoreEntry";
import { getProtonInfo, buildProtonEnvironment, buildProtonCommand } from "./linux/proton";
import { findLinuxSteamPath } from "./linux/steamPaths";

/** VDF leaves are plain strings, so only nested blocks can be indexed further. */
const asBlock = (value: VDFValue | undefined): VDFObject | undefined =>
  typeof value === "object" ? value : undefined;

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

/**
 * base class to interact with local steam installation
 * @class Steam
 */
class Steam implements IGameStore {
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;

  #baseFolder: string | undefined;
  #snapshot: IGameStoreSnapshot;

  constructor() {
    if (process.platform === "win32") {
      // windows
      try {
        const steamPath = winapi.RegGetValue(
          "HKEY_CURRENT_USER",
          "Software\\Valve\\Steam",
          "SteamPath",
        );
        this.#baseFolder = steamPath.value as string;
        this.#snapshot = { entries: [], isInstalled: true };
      } catch (err) {
        log("info", "steam not found", err);
        this.#baseFolder = undefined;
        this.#snapshot = { entries: [], isInstalled: false };
      }
    } else {
      const linuxPath = findLinuxSteamPath();
      this.#baseFolder = linuxPath;
      this.#snapshot = { entries: [], isInstalled: linuxPath !== undefined };
    }
  }

  /**
   * find the first game that matches the specified name pattern
   */
  public async findByName(namePattern: string): Promise<ISteamEntry> {
    const re = new RegExp("^" + namePattern + "$");
    const entries = await this.allGames();
    const entry = entries.find((entry) => re.test(entry.name));
    if (entry === undefined) throw new GameEntryNotFound(namePattern, STORE_ID);

    return entry;
  }

  public async launchGame(appInfo: any, api?: IExtensionApi): Promise<void> {
    // We expect appInfo to be one of three things at this point:
    //  - The game extension's details object if provided, in which case
    //      we want to extract the steamAppId entry. (preferred case as this
    //      is used by the gameinfo-steam extension as well).
    //  - The steam Id in string form.
    //  - The directory path which contains the game's executable.
    if (this.isCustomExecObject(appInfo) && appInfo.launchType === "gamestore") {
      const posix = await this.getPosixPath(appInfo);
      window.api.shell.openUrl(posix);
      return;
    }

    const info = appInfo.steamAppId ? appInfo.steamAppId.toString() : appInfo;
    const execInfo = await this.getExecInfo(info);

    // TODO: Bluebird to native
    await Promise.resolve(
      api?.runExecutable(execInfo.execPath, execInfo.arguments, {
        cwd: path.dirname(execInfo.execPath),
        suggestDeploy: true,
        shell: true,
      }),
    );
  }

  public getPosixPath(appInfo: any): Promise<string> {
    const posixCommand = `steam://launch/${appInfo.appId}/${appInfo.parameters.join()}`;
    return Promise.resolve(posixCommand);
  }

  public async getExecInfo(appInfo: any): Promise<IExecInfo> {
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
    const entries = await this.allGames();
    const found = entries.find((entry) =>
      !isDirPath
        ? entry.appid === appId
        : // Checking by gamepath is inefficient but I can't think of a different
          //  way to ascertain whether the launcher has this game entry with the
          //  provided information...
          appId.toLowerCase().indexOf(entry.gamePath.toLowerCase()) !== -1,
    );

    if (found === undefined) throw new GameEntryNotFound(appId, STORE_ID);

    return {
      execPath: path.join(this.#baseFolder, STEAM_EXEC),
      arguments: ["-applaunch", appId, ...parameters],
    };
  }

  /**
   * find the first game with the specified appid or one of the specified appids
   */
  public async findByAppId(appId: string | string[]): Promise<ISteamEntry> {
    // support searching for one app id or one out of a list (when there are multiple
    // variants of a game)
    const matcher = Array.isArray(appId)
      ? (entry) => appId.indexOf(entry.appid) !== -1
      : (entry) => entry.appid === appId;

    const entries = await this.allGames();
    const entry = entries.find(matcher);
    if (entry === undefined) {
      throw new GameEntryNotFound(Array.isArray(appId) ? appId.join(", ") : appId, STORE_ID);
    }

    return entry;
  }

  public allGames(): Promise<ISteamEntry[]> {
    return Promise.resolve(this.#snapshot.entries as ISteamEntry[]);
  }

  public snapshot(): IGameStoreSnapshot {
    return this.#snapshot;
  }

  public getGameStorePath(): Promise<string | undefined> {
    if (this.#baseFolder === undefined) return Promise.resolve(undefined);
    return Promise.resolve(path.join(this.#baseFolder, STEAM_EXEC));
  }

  public async reloadGames(): Promise<void> {
    const entries = await this.parseManifests();
    this.#snapshot = { entries, isInstalled: this.#snapshot.isInstalled };
  }

  public async identifyGame(
    gamePath: string,
    fallback: (gamePath: string) => PromiseLike<boolean>,
  ): Promise<boolean> {
    const custom = gamePath.toLowerCase().split(path.sep).includes("steamapps");

    const fbResult = await fallback(gamePath);
    if (fbResult !== custom) {
      log("warn", "(steam) game identification inconclusive", {
        gamePath,
        custom,
        fallback,
      });
    }

    return custom || fbResult;
  }

  private isCustomExecObject(object: any): object is ICustomExecutionInfo {
    if (typeof object !== "object") return false;
    return "appId" in object;
  }

  private async resolveSteamPaths(): Promise<string[]> {
    log("debug", "resolving Steam game paths");
    const basePath = this.#baseFolder;
    if (basePath === undefined) {
      // Steam not found/installed
      return [];
    }

    const steamPaths: string[] = [basePath];
    let parsedObj: VDFObject;

    try {
      const blob = await window.api.fs.readFile(
        QualifiedPath.fromNative(basePath).join("config", "libraryfolders.vdf"),
      );
      const data = new TextDecoder().decode(blob);

      try {
        parsedObj = parse(data);
      } catch (err) {
        log("warn", "unable to parse steamfolders.vdf", err);
        return steamPaths;
      }
    } catch (err) {
      // A Steam update has changed the way we resolve the steam library paths
      //  (we used to get these from config.vdf) the libraryfolders.vdf file
      //  appears to at times hold a reference to _all_ library folders; other times
      //  it only holds the path to the alternate steam libraries (the ones that aren't
      //  part of the base Steam installation folder)
      log("warn", "failed to read steam library folders file", err);

      const vortexError = parseError(err);
      if (vortexError.data.kind === "fs:not-found" || vortexError.data.kind === "fs:no-permissions")
        return steamPaths;
      throw err;
    }

    // older Steam versions spelled this key in mixed case
    const libKey = Object.keys(parsedObj).find((key) => key.toLowerCase() === "libraryfolders");
    const libObj = asBlock(libKey !== undefined ? parsedObj[libKey] : undefined) ?? {};

    // libraries are numbered contiguously, from 0 or 1 depending on the Steam version
    let counter = libObj["0"] !== undefined ? 0 : 1;
    let lib = asBlock(libObj[`${counter}`]);
    while (lib !== undefined) {
      const libPath = lib["path"];
      if (typeof libPath === "string" && libPath && !steamPaths.includes(libPath)) {
        steamPaths.push(libPath);
      }
      ++counter;
      lib = asBlock(libObj[`${counter}`]);
    }

    log("debug", "found steam install folders", { steamPaths });
    return steamPaths;
  }

  private async parseManifests(): Promise<ISteamEntry[]> {
    // A missing base folder means resolveSteamPaths yields nothing anyway,
    //  but reading the field up front lets us hand a non-undefined path down.
    const baseFolder = this.#baseFolder;
    if (baseFolder === undefined) {
      return [];
    }

    const steamPaths = await this.resolveSteamPaths();

    const games: ISteamEntry[] = [];
    for (const steamPath of steamPaths) {
      log("debug", "reading steam install folder", { steamPath });
      games.push(...(await this.parseLibrary(steamPath, baseFolder)));
    }

    log("info", "done reading steam libraries");
    return games;
  }

  /**
   * Parse one Steam library's appmanifest files.
   *
   * Errors are isolated per library: a disconnected or unreadable library is
   * logged and skipped, the remaining libraries keep scanning. (The
   * "not found" case is expected - Steam libraries can live on removable
   * media that is currently removed.)
   */
  private async parseLibrary(steamPath: string, baseFolder: string): Promise<ISteamEntry[]> {
    const steamAppsPath = path.join(steamPath, "steamapps");

    try {
      const entries: ISteamEntry[] = [];
      const iterator = await window.api.fs.enumerateDirectory(
        QualifiedPath.fromNative(steamAppsPath),
      );

      for await (const entry of iterator) {
        if (!entry.basename.startsWith("appmanifest_") || entry.extension !== "acf") continue;

        const game = await this.parseManifest(entry, steamAppsPath, baseFolder);
        if (game !== undefined) {
          entries.push(game);
        }
      }

      return entries;
    } catch (err) {
      if (parseError(err).data.kind === "fs:not-found") {
        log("info", "Steam library not found", { err });
      } else {
        log("warn", "Failed to read steam library", { path: steamPath, err });
      }
      return [];
    }
  }

  /**
   * Turn a single appmanifest_*.acf file into a game entry, enriching it with
   * Proton info on Linux. Returns undefined when the manifest is malformed;
   * a manifest that cannot be read propagates, which skips the rest of the
   * containing library.
   */
  private async parseManifest(
    entry: QualifiedPath,
    steamAppsPath: string,
    baseFolder: string,
  ): Promise<ISteamEntry | undefined> {
    const blob = await window.api.fs.readFile(entry);
    const manifestData = new TextDecoder().decode(blob);

    let parsedObj: VDFObject;
    try {
      parsedObj = parse(manifestData);
    } catch (err) {
      log("warn", "failed to parse steam manifest", { err, entry });
      return undefined;
    }

    if (parsedObj["AppState"] === undefined || parsedObj["AppState"]["installdir"] === undefined) {
      log("debug", "invalid appmanifest", { entry });
      return undefined;
    }

    try {
      const result: ISteamEntry = {
        appid: parsedObj["AppState"]["appid"],
        gameStoreId: STORE_ID,
        name: parsedObj["AppState"]["name"],
        gamePath: path.join(steamAppsPath, "common", parsedObj["AppState"]["installdir"]),
        lastUser: parsedObj["AppState"]["LastOwner"],
        lastUpdated: new Date(parsedObj["AppState"]["LastUpdated"] * 1000),
        manifestData: parsedObj,
      };

      if (process.platform === "linux") {
        try {
          const protonInfo = await getProtonInfo(baseFolder, steamAppsPath, result.appid);
          result.usesProton = protonInfo.usesProton;
          result.compatDataPath = protonInfo.compatDataPath;
          result.protonPath = protonInfo.protonPath;
        } catch (err) {
          log("debug", "Could not get Proton info for game", {
            appid: result.appid,
            err,
            entry,
          });
        }
      }

      return result;
    } catch (err) {
      log("warn", "failed to parse steam manifest", { entry, err });
      return undefined;
    }
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
    if (!gameEntry.usesProton || !gameEntry.protonPath || !gameEntry.compatDataPath) {
      return api.runExecutable(exePath, args, options);
    }

    const steamPath = this.#baseFolder;
    const { executable, args: protonArgs } = buildProtonCommand(
      gameEntry.protonPath,
      exePath,
      args,
    );
    const protonEnv = buildProtonEnvironment(gameEntry.compatDataPath, steamPath, options.env);

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
