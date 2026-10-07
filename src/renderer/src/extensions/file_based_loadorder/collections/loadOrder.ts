import * as React from "react";
import { z } from "zod";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IMod } from "../../mod_management/types/IMod";
import { lastActiveProfileForGame } from "../../profile_management/selectors";
import { setFBLoadOrder } from "../actions/loadOrder";
import { legacyOrderOwner } from "../adoption";
import type {
  ICollection,
  ICollectionLoadOrder,
  ICollectionNamedLoadOrder,
  IGameSpecificInterfaceProps,
} from "../types/collections";
import {
  CollectionGenerateError,
  CollectionParseError,
  collectionNamedLoadOrderSchema,
} from "../types/collections";
import type { IRegisteredLoadOrder, LoadOrder } from "../types/types";
import { genCollectionLoadOrder } from "../util";
import LoadOrderCollections from "../views/LoadOrderCollections";

export async function generate(
  api: IExtensionApi,
  gameEntries: IRegisteredLoadOrder[],
  modIds: string[],
  // keyed by Vortex mod id
  mods: Record<string, IMod>,
): Promise<ICollectionLoadOrder> {
  if (gameEntries.length === 0) {
    return undefined;
  }
  const profileId = lastActiveProfileForGame(api.getState(), gameEntries[0].gameId);
  if (profileId === undefined) {
    throw new CollectionGenerateError("Invalid profile");
  }
  const includedMods = modIds.reduce((accum, iter) => {
    if (mods[iter] !== undefined) {
      accum[iter] = mods[iter];
    }
    return accum;
  }, {});
  // keyed by load order id
  const loadOrders: Record<string, LoadOrder> = {};
  for (const gameEntry of gameEntries) {
    loadOrders[gameEntry.loadOrderId] = await genCollectionLoadOrder(
      api,
      gameEntry,
      includedMods,
      profileId,
    );
  }
  const legacyOwner = legacyOrderOwner(gameEntries);
  const exported: ICollectionLoadOrder = {
    loadOrder: legacyOwner === undefined ? [] : loadOrders[legacyOwner.loadOrderId],
  };
  const named = gameEntries.filter((gameEntry) => !gameEntry.isPrimary);
  if (named.length > 0) {
    exported.fbLoadOrders = named.map((gameEntry) => ({
      id: gameEntry.loadOrderId,
      entries: loadOrders[gameEntry.loadOrderId],
    }));
  }
  return exported;
}

const namedLoadOrdersSchema = z.array(collectionNamedLoadOrderSchema).optional();

// A collection's named load orders, validated because the manifest arrives untyped.
function namedLoadOrdersOf(collection: ICollection): ICollectionNamedLoadOrder[] {
  const parsed = namedLoadOrdersSchema.safeParse(collection.fbLoadOrders);
  if (!parsed.success) {
    throw new CollectionParseError(collection, parsed.error.message);
  }
  return parsed.data ?? [];
}

export function parser(
  api: IExtensionApi,
  gameEntries: IRegisteredLoadOrder[],
  gameId: string,
  collection: ICollection,
): Promise<void> {
  return Promise.resolve().then(() => {
    const profileId = lastActiveProfileForGame(api.getState(), gameId);
    if (profileId === undefined) {
      throw new CollectionParseError(collection, "Invalid profile id");
    }
    const named = namedLoadOrdersOf(collection);
    api.store.dispatch(setFBLoadOrder(profileId, collection.loadOrder));
    for (const { id, entries } of named) {
      if (!gameEntries.some((gameEntry) => gameEntry.loadOrderId === id)) {
        log("warn", "collection carries a load order the game does not register", {
          gameId,
          loadOrderId: id,
        });
        continue;
      }
      api.store.dispatch(setFBLoadOrder(profileId, entries, id));
    }
  });
}

// The collection page's load order panel, resolving game entries through the given lookup.
export function collectionInterface(
  getGameEntry: (gameId: string) => IRegisteredLoadOrder | undefined,
): (props: IGameSpecificInterfaceProps) => JSX.Element {
  return (props) => React.createElement(LoadOrderCollections, { ...props, getGameEntry });
}
