import * as path from "path";

import Bluebird from "bluebird";
import * as winapi from "winapi-bindings";

import { log } from "@/logging";
import { makeExeId } from "@/reducers/session";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IGameStore } from "@/types/IGameStore";
import { GameEntryNotFound, GameStoreNotFound } from "@/types/IGameStore";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";

import { ProcessCanceled } from "./CustomErrors";
import * as fs from "./fs";
import { defaultPriority, type IQueryArgEntry, normalizeStoreQuery } from "./storeQuery";
import { toBlue } from "./util";

type SearchType = "name" | "id";

/**
 * Search for a specific game store. Throws GameStoreNotFound when the
 * stores have loaded but the id is unknown; undefined while no store is
 * registered at all.
 */
export function getGameStore(stores: IGameStore[], storeId: string): IGameStore | undefined {
  const gameStore = stores.find((store) => store.id === storeId);
  if (stores.length > 0 && gameStore === undefined) {
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
export function isGameInstalled(
  stores: IGameStore[],
  id: string,
  storeId?: string,
): Bluebird<string | undefined> {
  return Bluebird.try(() => findGameEntry(stores, "id", id, storeId))
    .then((entry) => entry.gameStoreId)
    .catch(() => undefined);
}

export function isGameStoreInstalled(stores: IGameStore[], storeId: string): Bluebird<boolean> {
  try {
    const gameStore = getGameStore(stores, storeId);
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

export function registryLookup(lookup: string): Bluebird<IGameStoreEntry> {
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

export const find = toBlue(
  async (stores: IGameStore[], query: { [storeId: string]: IQueryArgEntry }) => {
    const results: IGameStoreEntry[] = [];
    const storesDict = stores.reduce<{ [storeId: string]: IGameStore }>((prev, store) => {
      prev[store.id] = store;
      return prev;
    }, {});
    for (const storeId of Object.keys(query)) {
      const storeQueries = normalizeStoreQuery(query[storeId]);
      let prioOffset = 0;
      for (const storeQuery of storeQueries) {
        let result: IGameStoreEntry | undefined = undefined;
        try {
          if (storeId === "registry") {
            result = await registryLookup(storeQuery.id);
          } else if (storeQuery.id !== undefined) {
            result = await findGameEntry(stores, "id", storeQuery.id, storeId);
          } else if (storeQuery.name !== undefined) {
            result = await findGameEntry(stores, "name", storeQuery.name, storeId);
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
            storeQuery.prefer ?? storesDict[result.gameStoreId]?.priority ?? defaultPriority;
          result.priority += prioOffset++ / 1000;
          results.push(result);
        }
      }
    }
    return results;
  },
);

export function findByName(
  stores: IGameStore[],
  name: string | string[],
  storeId?: string,
): Bluebird<IGameStoreEntry> {
  if (!validInput(name)) {
    return Bluebird.reject(
      new GameEntryNotFound("Invalid name input", stores.map((store) => store.id).join(", ")),
    );
  }
  return Bluebird.try(() => findGameEntry(stores, "name", name, storeId));
}

export function findByAppId(
  stores: IGameStore[],
  appId: string | string[],
  storeId?: string,
): Bluebird<IGameStoreEntry> {
  if (!validInput(appId)) {
    return Bluebird.reject(
      new GameEntryNotFound("Invalid appId input", stores.map((store) => store.id).join(", ")),
    );
  }
  return Bluebird.try(() => findGameEntry(stores, "id", appId, storeId));
}

export function launchGameStore(
  stores: IGameStore[],
  api: IExtensionApi,
  gameStoreId: string,
  parameters?: string[],
): Bluebird<void> {
  let gameStore: IGameStore | undefined;
  try {
    gameStore = getGameStore(stores, gameStoreId);
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
  void launchStoreAsync(stores, api, gameStore, gameStoreId, parameters);
  return Bluebird.resolve();
}

async function launchStoreAsync(
  stores: IGameStore[],
  api: IExtensionApi,
  gameStore: IGameStore,
  gameStoreId: string,
  parameters?: string[],
): Promise<void> {
  const t = api.translate;

  // TODO: Bluebird to native
  const isInstalled = await Promise.resolve(isGameStoreInstalled(stores, gameStoreId));

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
    if (!!launcherPath && !isStoreRunning(launcherPath)) {
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

function isStoreRunning(storeExecPath: string) {
  const runningProcesses = winapi.GetProcessList();
  const exeId = makeExeId(storeExecPath);
  return (
    runningProcesses.find((runningProc) => exeId === runningProc.exeFile.toLowerCase()) !==
    undefined
  );
}

function validInput(input: string | string[]): boolean {
  return !input || (Array.isArray(input) && input.length === 0) ? false : true;
}

/**
 * Reads the stores' snapshot data synchronously and returns the first
 * matching entry, in store order. Throws GameEntryNotFound on a miss:
 * a miss never triggers a scan and never waits. Before the first scan
 * completes the snapshots are empty, so lookups reject GameEntryNotFound.
 * @param stores the store list to scan, as exposed by GameModeManager.
 * @param searchType dictates which functor we execute.
 * @param pattern the pattern we're looking for.
 * @param storeId optional parameter used when trying to query a specific store.
 */
function findGameEntry(
  stores: IGameStore[],
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

  const availableStores = stores.map((store) => store.id).join(", ");

  // queriedStore object is only populated if the game store helper caller
  //  is looking for a specific game store.
  let queriedStore: IGameStore | undefined = undefined;
  if (storeId) {
    try {
      queriedStore = getGameStore(stores, storeId);
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

  const gameStores: IGameStore[] = (queriedStore ? [queriedStore] : stores).filter(Boolean);

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
