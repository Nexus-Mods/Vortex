import React = require('react');
import * as types from '../../../types/api';
import { lastActiveProfileForGame } from '../../../extensions/profile_management/activeGameId';

import { setFBLoadOrder } from '../actions/loadOrder';

import {
  CollectionGenerateError, CollectionParseError, ICollection,
  ICollectionLoadOrder, IGameSpecificInterfaceProps,
} from '../types/collections';

import { ILoadOrderGameInfoExt } from '../types/types';

import { findGameEntry } from '../gameSupport';
import { genCollectionLoadOrder, toExtendedLoadOrderEntry } from '../util';

import LoadOrderCollections from '../views/LoadOrderCollections';
import UpdateSet from '../UpdateSet';

export async function generate(api: types.IExtensionApi,
                               state: types.IState,
                               gameId: string,
                               stagingPath: string,
                               modIds: string[],
                               mods: { [modId: string]: types.IMod })
                               : Promise<ICollectionLoadOrder> {
  const gameEntry: ILoadOrderGameInfoExt = findGameEntry(gameId);
  if (gameEntry === undefined) {
    return;
  }

  let loadOrder;
  try {
    const profileId = lastActiveProfileForGame(api.getState(), gameEntry.gameId);
    if (profileId === undefined) {
      throw new CollectionGenerateError('Invalid profile');
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

export async function parser(api: types.IExtensionApi,
                             gameId: string,
                             collection: ICollection,
                             updateSet: UpdateSet): Promise<void> {
  const state = api.getState();

  const profileId = lastActiveProfileForGame(state, gameId);
  if (profileId === undefined) {
    return Promise.reject(new CollectionParseError(collection, 'Invalid profile id'));
  }

  updateSet.init(gameId, (collection.loadOrder ?? []).map(toExtendedLoadOrderEntry(api)));
  api.store.dispatch(setFBLoadOrder(profileId, collection.loadOrder));
  return Promise.resolve(undefined);
}

export function Interface(props: IGameSpecificInterfaceProps): JSX.Element {
  return React.createElement(LoadOrderCollections, (props as any), []);
}
