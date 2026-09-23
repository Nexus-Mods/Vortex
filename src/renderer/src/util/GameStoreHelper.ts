import * as path from "path";

import Bluebird from "bluebird";
import * as winapi from "winapi-bindings";

import { log } from "@/logging";

import { getGameStores } from "../extensions/gamemode_management/util/getGame";
import { makeExeId } from "../reducers/session";
import type { IExtensionApi } from "../types/IExtensionContext";
import type { IGameStore } from "../types/IGameStore";
import { GameEntryNotFound, GameStoreNotFound } from "../types/IGameStore";
import type { IGameStoreEntry } from "../types/IGameStoreEntry";
import { ProcessCanceled } from "./CustomErrors";
import * as fs from "./fs";
import { toBlue } from "./util";

export const defaultPriority = 100;
type SearchType = "name" | "id";

export interface IStoreQuery {
  id?: string;
  name?: string;
  prefer?: number;
}

/** Normalized form of one store's IGame.queryArgs entry. */
export type IQueryArgEntry = string | IStoreQuery | IStoreQuery[];

export interface IGameStoreHelper {
  isGameInstalled(id: string, storeId?: string): Bluebird<string | undefined>;

  findByName(name: string | string[], storeId?: string): Bluebird<IGameStoreEntry>;

  findByAppId(appId: string | string[], storeId?: string): Bluebird<IGameStoreEntry>;

  launchGameStore(api: IExtensionApi, gameStoreId: string, parameters?: string[]): Bluebird<void>;
}

/**
 * Normalize the polymorphic form `IGame.queryArgs` accepts (string app ID,
 * single query, or array) into a single array of IStoreQuery. Callers that
 * iterate per-store entries should funnel through this so the three forms
 * are handled in one place.
 */
export function normalizeStoreQuery(raw: IQueryArgEntry | undefined): IStoreQuery[] {
  if (raw === undefined) return [];
  if (typeof raw === "string") return [{ id: raw }];
  if (Array.isArray(raw)) return raw;
  return [raw];
}

export class GameStoreHelper implements IGameStoreHelper {
  #stores: IGameStore[];
  #storesDict: { [storeId: string]: IGameStore };

  // Search for a specific game store.
  public getGameStore(storeId: string): IGameStore | undefined {
    const gameStores = this.getStores();
    const gameStore = gameStores.find((store) => store.id === storeId);
    if (gameStores.length > 0 && gameStore === undefined) {
      // The game stores are guaranteed to have loaded at this point,
      //  yet the store Id we're looking for is not in the store array.
      throw new GameStoreNotFound(storeId);
    }

    return gameStore;
  }

  // Returns the id of the first game store that has
  //  an existing game entry for the game we're looking for.
  //  Will return undefined if no store has a matching game entry.
  // OR
  // If a store id is specified, it will return the provided
  //  store id if the game is installed using the specified store id;
  //  otherwise will return undefined.
  public isGameInstalled(id: string, storeId?: string): Bluebird<string | undefined> {
    return Bluebird.try(() => this.findGameEntry("id", id, storeId))
      .then((entry) => entry.gameStoreId)
      .catch(() => undefined);
  }

  public isGameStoreInstalled(storeId: string): Bluebird<boolean> {
    try {
      const gameStore = this.getGameStore(storeId);
      return gameStore?.isGameStoreInstalled
        ? gameStore.isGameStoreInstalled()
        : (gameStore
            ?.getGameStorePath()
            .then((execPath) =>
              execPath === undefined
                ? Bluebird.reject(new Error(`failed to determine path for ${storeId}`))
                : fs.statAsync(execPath),
            )
            .then(() => Bluebird.resolve(true))
            .catch((err) => {
              log("debug", "gamestore is not installed", err);
              return Bluebird.resolve(false);
            }) ?? Bluebird.resolve(false));
    } catch {
      return Bluebird.resolve(false);
    }
  }

  public registryLookup(lookup: string): Bluebird<IGameStoreEntry> {
    if (lookup === undefined) {
      return Bluebird.reject(new Error("invalid store query, provide an id!"));
    }

    const chunked = lookup.split(":", 3);

    if (chunked.length !== 3) {
      return Bluebird.reject(new Error("invalid query, should be hive:path:key"));
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
      return Bluebird.reject(
        new Error("invalid query, hive should be something like HKEY_LOCAL_MACHINE"),
      );
    }

    try {
      const instPath = winapi.RegGetValue(chunked[0] as any, chunked[1], chunked[2]);
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
      return Bluebird.resolve(result);
    } catch {
      return Bluebird.reject(new GameEntryNotFound(lookup, "registry"));
    }
  }

  public find = toBlue(
    async (query: { [storeId: string]: IQueryArgEntry }): Promise<IGameStoreEntry[]> => {
      const results: IGameStoreEntry[] = [];
      for (const storeId of Object.keys(query)) {
        const storeQueries = normalizeStoreQuery(query[storeId]);
        let prioOffset = 0;
        for (const storeQuery of storeQueries) {
          let result: IGameStoreEntry | undefined = undefined;
          try {
            if (storeId === "registry") {
              result = await this.registryLookup(storeQuery.id);
            } else if (storeQuery.id !== undefined) {
              result = await this.findGameEntry("id", storeQuery.id, storeId);
            } else if (storeQuery.name !== undefined) {
              result = await this.findGameEntry("name", storeQuery.name, storeId);
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
              this.#storesDict[result.gameStoreId]?.priority ??
              defaultPriority;
            result.priority += prioOffset++ / 1000;
            results.push(result);
          }
        }
      }
      return results;
    },
  );

  public findByName(name: string | string[], storeId?: string): Bluebird<IGameStoreEntry> {
    if (!this.validInput(name)) {
      return Bluebird.reject(
        new GameEntryNotFound(
          "Invalid name input",
          this.getStores()
            .map((store) => store.id)
            .join(", "),
        ),
      );
    }
    return Bluebird.try(() => this.findGameEntry("name", name, storeId));
  }

  public findByAppId(appId: string | string[], storeId?: string): Bluebird<IGameStoreEntry> {
    if (!this.validInput(appId)) {
      return Bluebird.reject(
        new GameEntryNotFound(
          "Invalid appId input",
          this.getStores()
            .map((store) => store.id)
            .join(", "),
        ),
      );
    }
    return Bluebird.try(() => this.findGameEntry("id", appId, storeId));
  }

  public launchGameStore(
    api: IExtensionApi,
    gameStoreId: string,
    parameters?: string[],
  ): Bluebird<void> {
    let gameStore: IGameStore | undefined;
    try {
      gameStore = this.getGameStore(gameStoreId);
      if (!gameStore?.getGameStorePath) {
        throw new ProcessCanceled("gamestore implementation does not define getGameStorePath");
      }
    } catch (err) {
      api.showErrorNotification?.("Failed to launch game store", err);
      return Bluebird.resolve();
    }

    // Strict fire-and-forget: the launch chain runs detached and failures
    // are reported through notifications only. Launching a store is
    // best-effort, so callers get their confirmation immediately.
    void this.launchStoreAsync(api, gameStore, gameStoreId, parameters);
    return Bluebird.resolve();
  }

  private async launchStoreAsync(
    api: IExtensionApi,
    gameStore: IGameStore,
    gameStoreId: string,
    parameters?: string[],
  ): Promise<void> {
    const t = api.translate;

    // TODO: Bluebird to native
    const isInstalled = await Promise.resolve(this.isGameStoreInstalled(gameStoreId));

    if (!isInstalled) {
      api.showErrorNotification?.(
        "Game store is not installed",
        t("Please install/reinstall {{storeId}} to be able to launch this game store.", {
          replace: { storeId: gameStoreId },
        }),
        { allowReport: false },
      );

      return;
    }

    if (gameStore.launchGameStore) {
      const bluebird = gameStore.launchGameStore(api, parameters).catch((err) => {
        api.showErrorNotification?.("Failed to launch game store", err);
        return Bluebird.resolve();
      });

      // TODO: Bluebird to native
      await Promise.resolve(bluebird);
      return;
    }

    try {
      const launcherPath = await Promise.resolve(gameStore.getGameStorePath());
      if (!!launcherPath && !this.isStoreRunning(launcherPath)) {
        const bluebird = api.runExecutable(launcherPath, parameters || [], {
          detach: true,
          suggestDeploy: false,
        });

        // TODO: Bluebird to native
        await Promise.resolve(bluebird);
      }
    } catch (err) {
      api.showErrorNotification?.("Failed to launch game store", err);
    }
  }

  /**
   * @returns list of stores, sorted by priority
   */
  public storeIds(): IGameStore[] {
    return this.#stores.sort(
      (lhs: IGameStore, rhs: IGameStore) =>
        (lhs.priority ?? defaultPriority) - (rhs.priority ?? defaultPriority),
    );
  }

  private isStoreRunning(storeExecPath: string) {
    const runningProcesses = winapi.GetProcessList();
    const exeId = makeExeId(storeExecPath);
    return (
      runningProcesses.find((runningProc) => exeId === runningProc.exeFile.toLowerCase()) !==
      undefined
    );
  }

  private validInput(input: string | string[]): boolean {
    return !input || (Array.isArray(input) && input.length === 0) ? false : true;
  }

  private getStores(): IGameStore[] {
    if (this.#stores) {
      return this.#stores;
    }

    // It's possible that the game mode manager has yet
    //  to load the stores.
    try {
      this.#stores = getGameStores().filter((store) => !!store);
      this.#storesDict = this.#stores.reduce(
        (prev: { [storeId: string]: IGameStore }, store: IGameStore) => {
          prev[store.id] = store;
          return prev;
        },
        {},
      );
      return this.#stores;
    } catch (err) {
      log("debug", "stores have yet to load", err);
      return [];
    }
  }

  /**
   * Reads the stores' snapshot data synchronously and returns the first
   * matching entry, in store order. Throws GameEntryNotFound on a miss:
   * a miss never triggers a scan and never waits. Before the first scan
   * completes the snapshots are empty, so lookups reject GameEntryNotFound.
   * @param searchType dictates which functor we execute.
   * @param pattern the pattern we're looking for.
   * @param storeId optional parameter used when trying to query a specific store.
   */
  private findGameEntry(
    searchType: SearchType,
    pattern: string | string[],
    storeId?: string,
  ): IGameStoreEntry {
    const entryInfo = (entry: IGameStoreEntry): string =>
      searchType === "id" ? entry.appid : entry.name;

    const wrapNamePattern = (gameName: string): string => {
      if (searchType !== "name") {
        // Not a name searchType.
        return gameName;
      }

      // We need to match the game name _exactly_ otherwise
      //  false positives could occur, for example:
      //  The Elder Scrolls V: Skyrim could potentially match
      //  The Elder Scrolls V: Skyrim Special Edition, in which
      //  case the game extension will look for TESV.exe and be unable
      //  to find it, failing discovery completely even though the user
      //  has Oldrim installed in a different location.
      return "^" + gameName + "$";
    };

    // For obvious reasons, this should only be used for
    //  name searchTypes; using this for id's would potentially
    // cause false positives.
    const rgxMatcher = Array.isArray(pattern)
      ? new RegExp(pattern.map(wrapNamePattern).join("|"))
      : new RegExp(wrapNamePattern(pattern));

    const matcher = Array.isArray(pattern)
      ? (entry: IGameStoreEntry) => pattern.indexOf(entryInfo(entry)) !== -1
      : (entry: IGameStoreEntry) => entryInfo(entry) === pattern;

    const name = Array.isArray(pattern) ? pattern.join(" - ") : pattern;

    const availableStores = this.getStores()
      .map((store) => store.id)
      .join(", ");

    // queriedStore object is only populated if the game store helper caller
    //  is looking for a specific game store.
    let queriedStore: IGameStore | undefined = undefined;
    if (storeId) {
      try {
        queriedStore = this.getGameStore(storeId);
      } catch (err) {
        // It's possible for a game store to be missing
        //  especially if it is added by a 3rd party extension.
        log("warn", "Game entry not found in specified store", {
          pattern: name,
          storeId,
          availableStores,
          err,
        });

        throw new GameEntryNotFound(name, availableStores);
      }
    }

    const gameStores: IGameStore[] = (queriedStore ? [queriedStore] : this.getStores()).filter(
      Boolean,
    );

    if (gameStores.length === 0) {
      log("debug", "Game entry not found", {
        pattern: name,
        availableStores,
      });
      throw new GameEntryNotFound(name, availableStores);
    }

    for (const store of gameStores) {
      const entries = store.snapshot().entries;
      const entry =
        searchType === "id"
          ? entries.find(matcher)
          : entries.find((ent) => rgxMatcher.test(ent.name));

      if (entry !== undefined) {
        return entry;
      }
    }

    log("debug", "Game entry not found", {
      pattern: name,
      availableStores,
    });

    throw new GameEntryNotFound(name, availableStores);
  }
}

const instance: GameStoreHelper = new GameStoreHelper();
export default instance;
