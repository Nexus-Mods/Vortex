import Bluebird from "bluebird";

import { log } from "@/logging";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IGameStore } from "@/types/IGameStore";
import { GameEntryNotFound } from "@/types/IGameStore";
import type { IGameStoreEntry } from "@/types/IGameStoreEntry";

import { ProcessCanceled } from "./CustomErrors";
import * as storeLookup from "./storeLookup";

/**
 * The extension API's game store surface. Dumb on purpose: implements
 * IGameStoreHelper by delegating to ./storeLookup over the store list
 * GameModeManager exposes. This file is the interface contract and nothing
 * else - all logic is internal.
 *
 * gamemode_management attaches the store accessor once the manager exists
 * (see its index.ts). Before that, lookups behave with today's degraded
 * semantics: misses reject GameEntryNotFound, isGameInstalled resolves
 * undefined, launch reports an error notification.
 */
export interface IGameStoreHelper {
  isGameInstalled(id: string, storeId?: string): Bluebird<string | undefined>;

  findByName(name: string | string[], storeId?: string): Bluebird<IGameStoreEntry>;

  findByAppId(appId: string | string[], storeId?: string): Bluebird<IGameStoreEntry>;

  launchGameStore(api: IExtensionApi, gameStoreId: string, parameters?: string[]): Bluebird<void>;
}

export class GameStoreHelper implements IGameStoreHelper {
  #getStores: (() => IGameStore[]) | undefined;

  /**
   * Hand the helper the accessor for the current store list. Called once
   * by gamemode_management when the GameModeManager is constructed.
   */
  public attach(getStores: () => IGameStore[]): void {
    this.#getStores = getStores;
  }

  public isGameInstalled(id: string, storeId?: string): Bluebird<string | undefined> {
    if (this.#getStores === undefined) {
      return Bluebird.resolve(undefined);
    }
    return storeLookup.isGameInstalled(this.#getStores(), id, storeId);
  }

  public findByName(name: string | string[], storeId?: string): Bluebird<IGameStoreEntry> {
    if (this.#getStores === undefined) {
      log("debug", "stores have yet to load");
      return Bluebird.reject(new GameEntryNotFound(String(name), ""));
    }
    return storeLookup.findByName(this.#getStores(), name, storeId);
  }

  public findByAppId(appId: string | string[], storeId?: string): Bluebird<IGameStoreEntry> {
    if (this.#getStores === undefined) {
      log("debug", "stores have yet to load");
      return Bluebird.reject(new GameEntryNotFound(String(appId), ""));
    }
    return storeLookup.findByAppId(this.#getStores(), appId, storeId);
  }

  public launchGameStore(
    api: IExtensionApi,
    gameStoreId: string,
    parameters?: string[],
  ): Bluebird<void> {
    if (this.#getStores === undefined) {
      api.showErrorNotification?.(
        "Failed to launch game store",
        new ProcessCanceled("game store helper not initialized"),
      );
      return Bluebird.resolve();
    }
    return storeLookup.launchGameStore(this.#getStores(), api, gameStoreId, parameters);
  }
}

const instance: GameStoreHelper = new GameStoreHelper();
export default instance;
