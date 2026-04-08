import * as path from "path";
import * as winapi from "winapi-bindings";

import type { IExtensionApi } from "../types/IExtensionContext";
import type { IGameStore } from "../types/IGameStore";
import type { IGameStoreEntry } from "../types/IGameStoreEntry";

import { makeExeId } from "../reducers/session";
import { GameEntryNotFound, GameStoreNotFound } from "../types/IGameStore";
import { ProcessCanceled, UserCanceled } from "./CustomErrors";

// Lazy imports to avoid initializing store singletons at module load time
// (Steam/Epic constructors require applicationData to be initialized first)
function getSteam() { return require("./Steam").default; }
function getEpicGamesLauncher() { return require("./EpicGamesLauncher").default; }
import * as fs from "./fs";
import getNormalizeFunc from "./getNormalizeFunc";
import { log } from "./log";
import opn from "./opn";
import { getQueryClient } from "./queryClient";

export const defaultPriority = 100;
type SearchType = "name" | "id";

interface IStoreGameRow {
  store_type: string;
  store_id: string;
  install_path: string;
  name: string | null;
  store_metadata: string | null;
}

interface IStoreGameMetadata {
  compatDataPath?: string;
  executionName?: string;
  lastUpdated?: number;
  lastUser?: string;
  protonPath?: string;
  publisherId?: string;
  usesProton?: boolean;
}

const STORE_PRIORITIES: Record<string, number> = {
  gog: 15,
  steam: 40,
  origin: 50,
  uplay: 55,
  epic: 60,
  registry: 100,
  xbox: 105,
};

const STORE_NAMES: Record<string, string> = {
  epic: "Epic Games Launcher",
  gog: "GOG",
  origin: "Origin",
  registry: "Registry",
  steam: "Steam",
  uplay: "Uplay",
  xbox: "Xbox",
};

const REG_GOG_CLIENT = "SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient\\paths";
const REG_ORIGIN_CLIENT = "SOFTWARE\\WOW6432Node\\Origin";
const REG_UPLAY_CLIENT = "SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher";
const REG_UPLAY_EXEC = "Uplay.exe";
const GOG_EXEC = "GalaxyClient.exe";
const XBOX_REPOSITORY_PATH =
  "Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages";
const XBOX_APP_NAMES = ["microsoft.xboxapp", "microsoft.gamingapp"];
const STORE_INFOS: IGameStore[] = [
  { id: "gog", name: "GOG", priority: STORE_PRIORITIES.gog } as IGameStore,
  { id: "steam", name: "Steam", priority: STORE_PRIORITIES.steam } as IGameStore,
  { id: "origin", name: "Origin", priority: STORE_PRIORITIES.origin } as IGameStore,
  { id: "uplay", name: "Uplay", priority: STORE_PRIORITIES.uplay } as IGameStore,
  { id: "epic", name: "Epic Games Launcher", priority: STORE_PRIORITIES.epic } as IGameStore,
  { id: "registry", name: "Registry", priority: STORE_PRIORITIES.registry } as IGameStore,
  { id: "xbox", name: "Xbox", priority: STORE_PRIORITIES.xbox } as IGameStore,
];

export interface IStoreQuery {
  id?: string;
  name?: string;
  prefer?: number;
}

class GameStoreHelper {
  public getStoreName(storeId: string): string | undefined {
    return STORE_NAMES[storeId];
  }

  // Returns the id of the first game store that has
  //  an existing game entry for the game we're looking for.
  //  Will return undefined if no store has a matching game entry.
  // OR
  // If a store id is specified, it will return the provided
  //  store id if the game is installed using the specified store id;
  //  otherwise will return undefined.
  public isGameInstalled(
    id: string,
    storeId?: string,
  ): PromiseLike<string | undefined> {
    return (
      storeId !== undefined
        ? this.findGameEntry("id", id, storeId)
        : this.findGameEntry("id", id)
    )
      .then((entry) => entry?.gameStoreId)
      .catch(() => undefined);
  }

  public async isGameStoreInstalled(storeId: string): Promise<boolean> {
    const launcherPath = await this.getLauncherExecutablePath(storeId);
    if (storeId === "xbox") {
      return this.isXboxStoreInstalled();
    }
    if (launcherPath === undefined) {
      return false;
    }
    try {
      await fs.statAsync(launcherPath);
      return true;
    } catch (err) {
      log("debug", "gamestore is not installed", err);
      return false;
    }
  }

  public registryLookup(lookup: string): PromiseLike<IGameStoreEntry> {
    if (lookup === undefined) {
      return Promise.reject(new Error("invalid store query, provide an id!"));
    }

    const chunked = lookup.split(":", 3);

    if (chunked.length !== 3) {
      return Promise.reject(
        new Error("invalid query, should be hive:path:key"),
      );
    }

    if (
      ![
        "HKEY_CLASSES_ROOT",
        "HKEY_CURRENT_CONFIG",
        "HKEY_CURRENT_USER",
        "HKEY_LOCAL_MACHINE",
        "HKEY_USERS",
      ].includes(chunked[0])
    ) {
      return Promise.reject(
        new Error(
          "invalid query, hive should be something like HKEY_LOCAL_MACHINE",
        ),
      );
    }

    try {
      const instPath = winapi.RegGetValue(
        chunked[0] as any,
        chunked[1],
        chunked[2],
      );
      if (!instPath || instPath.type !== "REG_SZ") {
        throw new Error("empty or invalid registry key");
      }

      const result: IGameStoreEntry = {
        appid: lookup,
        gamePath: instPath.value as string,
        gameStoreId: "registry",
        name: path.basename(instPath.value as string),
        priority: defaultPriority,
      };
      return Promise.resolve(result);
    } catch (err) {
      return Promise.reject(new GameEntryNotFound(lookup, "registry"));
    }
  }

  public find = async (
    query: Record<string, IStoreQuery[]>,
  ): Promise<IGameStoreEntry[]> => {
    const results: IGameStoreEntry[] = [];
    for (const storeId of Object.keys(query)) {
      let prioOffset = 0;
      for (const storeQuery of query[storeId]) {
        let result: IGameStoreEntry | undefined = undefined;
        try {
          if (storeId === "registry") {
            result = await this.registryLookup(storeQuery.id);
          } else if (storeQuery.id !== undefined) {
            result = await this.findGameEntry("id", storeQuery.id, storeId);
          } else if (storeQuery.name !== undefined) {
            result = await this.findGameEntry(
              "name",
              storeQuery.name,
              storeId,
            );
          } else {
            throw new Error("invalid store query, set either id or name");
          }
        } catch (err) {
          if (!(err instanceof GameEntryNotFound)) {
            log("error", "Failed to look up game", {
              storeId,
              appid: storeQuery.id,
              name: storeQuery.name,
            });
          }
        }
        if (result) {
          result.priority =
            storeQuery.prefer ??
            this.storePriority(result.gameStoreId) ??
            defaultPriority;
          result.priority += prioOffset++ / 1000;
          results.push(result);
        }
      }
    }
    return results;
  };

  public findByName(
    name: string | string[],
    storeId?: string,
  ): PromiseLike<IGameStoreEntry> {
    return this.validInput(name)
      ? this.findGameEntry("name", name, storeId)
      : Promise.reject(
          new GameEntryNotFound(
            "Invalid name input",
            this.availableStoreNames(),
          ),
        );
  }

  public findByAppId(
    appId: string | string[],
    storeId?: string,
  ): PromiseLike<IGameStoreEntry> {
    return this.validInput(appId)
      ? this.findGameEntry("id", appId, storeId)
      : Promise.reject(
          new GameEntryNotFound(
            "Invalid appId input",
            this.availableStoreNames(),
          ),
        );
  }

  public async findByPath(
    gamePath: string,
    storeId?: string,
  ): Promise<IGameStoreEntry> {
    const normalize = await getNormalizeFunc(gamePath);
    const rows = await this.loadStoreGames();
    const normalizedPath = normalize(gamePath);
    const match = rows
      .filter((row) => storeId === undefined || row.store_type === storeId)
      .find((row) =>
        this.pathMatches(normalizedPath, normalize(row.install_path)),
      );

    if (match === undefined) {
      throw new GameEntryNotFound(
        gamePath,
        storeId ?? this.availableStoreNames(),
      );
    }

    return this.rowToEntry(match);
  }

  public launchGameStore(
    api: IExtensionApi,
    gameStoreId: string,
    parameters?: string[],
    askConsent: boolean = false,
  ): PromiseLike<void> {
    const t = api.translate;
    const launchStore = async () => {
      const gamestoreInstalled = await this.isGameStoreInstalled(gameStoreId);
      if (!gamestoreInstalled) {
        api.showErrorNotification?.(
          "Game store is not installed",
          t(
            "Please install/reinstall {{storeId}} to be able to launch this game store.",
            { replace: { storeId: gameStoreId } },
          ),
          { allowReport: false },
        );
        return;
      }
      return this.runtimeLaunchStore(api, gameStoreId, parameters);
    };

    const isGameStoreRunning = async () => {
      const launcherPath = await this.getLauncherExecutablePath(gameStoreId);
      return !!launcherPath && this.isStoreRunning(launcherPath);
    };

    const askConsentDialog = () => {
      return isGameStoreRunning().then((res) =>
        res
          ? Promise.resolve()
          : new Promise<void>((resolve, reject) => {
              api.showDialog?.(
                "info",
                api.translate("Game Store not Started"),
                {
                  text: api.translate(
                    "The game requires {{storeid}} to be running in parallel. " +
                      "Vortex will now attempt to start up the store for you.",
                    { replace: { storeid: gameStoreId } },
                  ),
                },
                [
                  { label: "Cancel", action: () => reject(new UserCanceled()) },
                  { label: "Start Store", action: () => resolve() },
                ],
              );
            }),
      );
    };

    // Ask consent or start up the store directly.
    const startStore = () =>
      askConsent
        ? askConsentDialog()
            .then(() => launchStore())
            .catch(() => Promise.resolve())
        : launchStore();

    // Start up the store.
    return startStore();
  }

  public async launchGame(
    api: IExtensionApi,
    gameStoreId: string,
    appInfo: any,
  ): Promise<void> {
    switch (gameStoreId) {
      case "steam":
        return getSteam().launchGame(appInfo, api);
      case "epic":
        return getEpicGamesLauncher().launchGame(appInfo, api);
      case "gog":
        return this.launchGOGGame(api, appInfo);
      case "origin":
        return this.launchURI(this.getOriginURI(this.extractAppId(appInfo)));
      case "uplay":
        return this.launchURI(this.getUplayURI(this.extractAppId(appInfo)));
      case "xbox":
        return this.launchXboxGame(api, appInfo);
      default:
        throw new GameStoreNotFound(gameStoreId);
    }
  }

  public identifyStore = async (gamePath: string) => {
    try {
      const match = await this.findByPath(gamePath);
      return match.gameStoreId;
    } catch {
      return undefined;
    }
  };

  /**
   * @returns list of stores, sorted by priority
   */
  public storeIds(): IGameStore[] {
    return STORE_INFOS.slice().sort(
      (lhs: IGameStore, rhs: IGameStore) =>
        (lhs.priority ?? defaultPriority) - (rhs.priority ?? defaultPriority),
    );
  }

  private isStoreRunning(storeExecPath: string) {
    const runningProcesses = winapi.GetProcessList();
    const exeId = makeExeId(storeExecPath);
    return (
      runningProcesses.find(
        (runningProc) => exeId === runningProc.exeFile.toLowerCase(),
      ) !== undefined
    );
  }

  private validInput(input: string | string[]): boolean {
    return !input || (Array.isArray(input) && input.length === 0)
      ? false
      : true;
  }

  private availableStoreNames(): string {
    return Object.keys(STORE_PRIORITIES).join(", ");
  }

  private extractAppId(appInfo: any): string {
    if (typeof appInfo === "object" && appInfo !== null) {
      if ("appId" in appInfo && appInfo.appId !== undefined) {
        return appInfo.appId.toString();
      }
      if ("steamAppId" in appInfo && appInfo.steamAppId !== undefined) {
        return appInfo.steamAppId.toString();
      }
      if ("gogAppId" in appInfo && appInfo.gogAppId !== undefined) {
        return appInfo.gogAppId.toString();
      }
      if ("epicAppId" in appInfo && appInfo.epicAppId !== undefined) {
        return appInfo.epicAppId.toString();
      }
    }

    return appInfo?.toString?.() ?? "";
  }

  private async getLauncherExecutablePath(
    storeId: string,
  ): Promise<string | undefined> {
    if (process.platform !== "win32" && !["steam"].includes(storeId)) {
      return undefined;
    }

    switch (storeId) {
      case "steam":
        return getSteam().getGameStorePath();
      case "epic":
        return getEpicGamesLauncher().getGameStorePath();
      case "gog":
        return this.normalizeExecutablePath(
          this.getRegistryString("HKEY_LOCAL_MACHINE", REG_GOG_CLIENT, "client"),
          GOG_EXEC,
        );
      case "origin":
        return this.normalizeExecutablePath(
          this.getRegistryString(
            "HKEY_LOCAL_MACHINE",
            REG_ORIGIN_CLIENT,
            "ClientPath",
          ),
        );
      case "uplay":
        return this.normalizeExecutablePath(
          this.getRegistryString(
            "HKEY_LOCAL_MACHINE",
            REG_UPLAY_CLIENT,
            "InstallDir",
          ),
          REG_UPLAY_EXEC,
        );
      default:
        return undefined;
    }
  }

  private getRegistryString(
    hive: winapi.REGISTRY_HIVE,
    key: string,
    value: string,
  ): string | undefined {
    try {
      return winapi.RegGetValue(hive, key, value).value as string;
    } catch {
      return undefined;
    }
  }

  private normalizeExecutablePath(
    baseOrExe: string | undefined,
    exeName?: string,
  ): string | undefined {
    if (baseOrExe === undefined) {
      return undefined;
    }
    if (baseOrExe.toLowerCase().endsWith(".exe")) {
      return baseOrExe;
    }
    return exeName === undefined ? baseOrExe : path.join(baseOrExe, exeName);
  }

  private isXboxStoreInstalled(): boolean {
    if (process.platform !== "win32") {
      return false;
    }

    try {
      let found = false;
      winapi.WithRegOpen("HKEY_CLASSES_ROOT", XBOX_REPOSITORY_PATH, (hkey) => {
        const keys = winapi.RegEnumKeys(hkey).map((key) => key.key.toLowerCase());
        found = keys.some((key) =>
          XBOX_APP_NAMES.some((name) => key.startsWith(name)),
        );
      });
      return found;
    } catch {
      return false;
    }
  }

  private async runtimeLaunchStore(
    api: IExtensionApi,
    gameStoreId: string,
    parameters?: string[],
  ): Promise<void> {
    switch (gameStoreId) {
      case "epic":
        return getEpicGamesLauncher().launchGameStore(api, parameters);
      case "xbox": {
        const execName =
          parameters !== undefined && parameters.length > 0
            ? parameters.join("")
            : "Microsoft.Xbox.App";
        return api.runExecutable(
          "explorer.exe",
          [`shell:appsFolder\\Microsoft.GamingApp_8wekyb3d8bbwe!${execName}`],
          { detach: true, shell: true, suggestDeploy: false },
        );
      }
      default: {
        const launcherPath = await this.getLauncherExecutablePath(gameStoreId);
        if (!!launcherPath && !this.isStoreRunning(launcherPath)) {
          return api.runExecutable(launcherPath, parameters || [], {
            detach: true,
            suggestDeploy: false,
            shell: true,
          });
        }
        return undefined;
      }
    }
  }

  private async launchURI(uri: string): Promise<void> {
    await opn(uri);
  }

  private getOriginURI(appId: string): string {
    return `origin2://game/launch?offerIds=${appId}`;
  }

  private getUplayURI(appId: string): string {
    return `uplay://launch/${appId}/0`;
  }

  private async launchGOGGame(api: IExtensionApi, appInfo: any): Promise<void> {
    const appId = this.extractAppId(appInfo);
    const entry = await this.findByAppId(appId, "gog");
    const launcherPath = await this.getLauncherExecutablePath("gog");
    if (launcherPath === undefined) {
      throw new GameStoreNotFound("gog");
    }
    return api.runExecutable(
      launcherPath,
      [
        "/command=runGame",
        `/gameId=${entry.appid}`,
        `path="${entry.gamePath}"`,
      ],
      {
        cwd: path.dirname(launcherPath),
        shell: true,
        suggestDeploy: true,
      },
    );
  }

  private async launchXboxGame(api: IExtensionApi, appInfo: any): Promise<void> {
    if (!appInfo) {
      throw new ProcessCanceled("appInfo is undefined/null");
    }

    const appId = this.extractAppId(appInfo);
    const entry = (await this.findByAppId(appId, "xbox")) as IGameStoreEntry &
      IStoreGameMetadata;
    const execName =
      typeof appInfo === "object" &&
      appInfo !== null &&
      Array.isArray(appInfo.parameters)
        ? appInfo.parameters.find((arg) => "appExecName" in arg)?.appExecName
        : undefined;
    const launchCommand = `shell:appsFolder\\${entry.appid}_${entry.publisherId}!${execName ?? entry.executionName ?? "App"}`;
    return api.runExecutable("explorer.exe", [launchCommand], {
      detach: true,
      shell: true,
      suggestDeploy: false,
    });
  }

  /**
   * Returns a store entry for a specified pattern.
   * @param searchType dictates which functor we execute.
   * @param pattern the pattern we're looking for.
   * @param storeId optional parameter used when trying to query a specific store.
   */
  private findGameEntry(
    searchType: SearchType,
    pattern: string | string[],
    storeId?: string,
  ): Promise<IGameStoreEntry> {
    const searchValue = Array.isArray(pattern) ? pattern.join(" - ") : pattern;

    return this.loadStoreGames().then((rows) => {
      const filteredRows = rows.filter(
        (row) => storeId === undefined || row.store_type === storeId,
      );
      const entry = filteredRows.find((row) => {
        if (searchType === "id") {
          return Array.isArray(pattern)
            ? pattern.includes(row.store_id)
            : row.store_id === pattern;
        }

        const names = Array.isArray(pattern) ? pattern : [pattern];
        return names.some((name) =>
          new RegExp(`^${name}$`).test(row.name ?? ""),
        );
      });

      if (entry === undefined) {
        log("debug", "Game entry not found", {
          pattern: searchValue,
          availableStores: this.availableStoreNames(),
        });
        throw new GameEntryNotFound(searchValue, this.availableStoreNames());
      }

      return this.rowToEntry(entry);
    });
  }

  private loadStoreGames(): Promise<IStoreGameRow[]> {
    return getQueryClient().ensureQueryData<IStoreGameRow[]>(
      "all_store_games",
      {},
    );
  }

  private parseStoreMetadata(row: IStoreGameRow): IStoreGameMetadata {
    if (!row.store_metadata) {
      return {};
    }

    try {
      return JSON.parse(row.store_metadata) as IStoreGameMetadata;
    } catch {
      return {};
    }
  }

  private rowToEntry(row: IStoreGameRow): IGameStoreEntry {
    const metadata = this.parseStoreMetadata(row);
    const entry = {
      appid: row.store_id,
      gamePath: row.install_path,
      name: row.name ?? "",
      gameStoreId: row.store_type,
      priority: this.storePriority(row.store_type),
    } as IGameStoreEntry & Partial<Record<keyof IStoreGameMetadata, unknown>>;

    if (metadata.lastUpdated !== undefined) {
      entry.lastUpdated = new Date(Number(metadata.lastUpdated));
    }
    if (metadata.lastUser !== undefined) {
      entry.lastUser = metadata.lastUser;
    }
    if (metadata.usesProton !== undefined) {
      entry.usesProton = metadata.usesProton;
    }
    if (metadata.compatDataPath !== undefined) {
      entry.compatDataPath = metadata.compatDataPath;
    }
    if (metadata.protonPath !== undefined) {
      entry.protonPath = metadata.protonPath;
    }
    if (metadata.executionName !== undefined) {
      entry.executionName = metadata.executionName;
    }
    if (metadata.publisherId !== undefined) {
      entry.publisherId = metadata.publisherId;
    }

    return entry;
  }

  private pathMatches(normalizedPath: string, normalizedInstallPath: string) {
    return (
      normalizedPath === normalizedInstallPath ||
      normalizedPath.startsWith(`${normalizedInstallPath}/`) ||
      normalizedPath.startsWith(`${normalizedInstallPath}\\`)
    );
  }

  private storePriority(storeId: string | undefined): number {
    if (storeId === undefined) {
      return defaultPriority;
    }

    return STORE_PRIORITIES[storeId] ?? defaultPriority;
  }
}

// const instance: GameStoreHelper = new GameStoreHelper();

const instance: GameStoreHelper = new Proxy(
  {},
  {
    get(target, name) {
      if (target["inst"] === undefined) {
        target["inst"] = new GameStoreHelper();
      }
      return target["inst"][name];
    },
    set(target, name, value) {
      if (target["inst"] === undefined) {
        target["inst"] = new GameStoreHelper();
      }
      target["inst"][name] = value;
      return true;
    },
  },
) as any;

export default instance;
