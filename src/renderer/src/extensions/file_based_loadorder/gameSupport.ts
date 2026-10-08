import { readFileSync } from "node:fs";
import path from "node:path";

import { log } from "../../logging";
import { isContributed } from "../../util/isContributed";
import { entriesForGame, findEntry, registrationRejection, resolveEntry } from "./registry";
import type { ILoadOrderGameInfo, IRegisteredLoadOrder } from "./types/types";

// The load orders game extensions registered.
export class LoadOrderRegistry {
  readonly #registered: IRegisteredLoadOrder[] = [];

  // Registers a load order for an extension installed at extensionPath.
  public add(gameEntry: ILoadOrderGameInfo, extensionPath: string): void {
    // The LO page registration can be done as an "addon" through
    //  another extension - which means we could have an officially supported
    //  game extension but an unofficial load order registration so checking if
    //  game.contributed === undefined is not sufficient - we need to read the
    //  info.json file of the extension that registers the LO page.
    this.#register(gameEntry, () => {
      try {
        const extensionInfo = JSON.parse(
          readFileSync(path.join(extensionPath, "info.json"), { encoding: "utf8" }),
        ) as { author?: string };
        return isContributed(extensionInfo.author);
      } catch (err) {
        log("error", "Failed to parse extension information", err);
        return undefined;
      }
    });
  }

  // Registers a load order without reading info.json, for the addLoadOrderPage api.
  public addInline(gameEntry: ILoadOrderGameInfo, isContributedEntry: boolean = false): void {
    this.#register(gameEntry, () => isContributedEntry);
  }

  public entries(gameId: string): IRegisteredLoadOrder[] {
    return entriesForGame(this.#registered, gameId);
  }

  // Without a load order id, the game's first listed load order: its primary when it has one.
  public find(gameId: string, loadOrderId?: string): IRegisteredLoadOrder | undefined {
    return findEntry(this.#registered, gameId, loadOrderId);
  }

  #register(gameEntry: ILoadOrderGameInfo, contributed: () => boolean | undefined): void {
    if (gameEntry === undefined) {
      log("error", "unable to add load order page - invalid game entry");
      return;
    }

    const rejection = registrationRejection(this.#registered, gameEntry);
    if (rejection !== undefined) {
      log("error", "load order registration rejected", {
        gameId: gameEntry.gameId,
        loadOrderId: gameEntry.loadOrderId,
        reason: rejection,
      });
      return;
    }

    const isContributedEntry = contributed();
    if (isContributedEntry === undefined) {
      return;
    }
    this.#registered.push(resolveEntry(gameEntry, isContributedEntry));
  }
}
