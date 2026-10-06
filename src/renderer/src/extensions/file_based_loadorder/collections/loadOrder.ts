import * as React from "react";

import type * as types from "../../../types/api";
import * as selectors from "../../../util/selectors";
import { setFBLoadOrder } from "../actions/loadOrder";
import type {
  ICollection,
  ICollectionLoadOrder,
  IGameSpecificInterfaceProps,
} from "../types/collections";
import { CollectionGenerateError, CollectionParseError } from "../types/collections";
import type { IRegisteredLoadOrder } from "../types/types";
import { genCollectionLoadOrder } from "../util";
import LoadOrderCollections from "../views/LoadOrderCollections";

export async function generate(
  api: types.IExtensionApi,
  gameEntry: IRegisteredLoadOrder | undefined,
  modIds: string[],
  mods: { [modId: string]: types.IMod },
): Promise<ICollectionLoadOrder> {
  if (gameEntry === undefined) {
    return;
  }

  let loadOrder;
  try {
    const profileId = selectors.lastActiveProfileForGame(api.getState(), gameEntry.gameId);
    if (profileId === undefined) {
      throw new CollectionGenerateError("Invalid profile");
    }
    const includedMods = modIds.reduce((accum, iter) => {
      if (mods[iter] !== undefined) {
        accum[iter] = mods[iter];
      }
      return accum;
    }, {});
    loadOrder = await genCollectionLoadOrder(api, gameEntry, includedMods, profileId);
  } catch (err) {
    return Promise.reject(err);
  }
  return Promise.resolve({ loadOrder });
}

export async function parser(
  api: types.IExtensionApi,
  gameId: string,
  collection: ICollection,
): Promise<void> {
  const state = api.getState();

  const profileId = selectors.lastActiveProfileForGame(state, gameId);
  if (profileId === undefined) {
    return Promise.reject(new CollectionParseError(collection, "Invalid profile id"));
  }

  api.store.dispatch(setFBLoadOrder(profileId, collection.loadOrder));
  return Promise.resolve(undefined);
}

// The collection page's load order panel, resolving game entries through the given lookup.
export function collectionInterface(
  getGameEntry: (gameId: string) => IRegisteredLoadOrder | undefined,
): (props: IGameSpecificInterfaceProps) => JSX.Element {
  return (props) => React.createElement(LoadOrderCollections, { ...props, getGameEntry });
}
