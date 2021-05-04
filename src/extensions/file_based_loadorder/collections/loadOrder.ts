import React = require('react');
import * as types from '../../../types/api';
import * as util from '../../../util/api';
import * as selectors from '../../../util/selectors';

import { setFBLoadOrder } from '../actions/loadOrder';

import {
  CollectionGenerateError, CollectionParseError, ICollection, ICollectionLoadOrder, IGameSpecificInterfaceProps
} from '../types/collections';

import { ILoadOrderGameInfoExt, IValidationResult, LoadOrder, LoadOrderValidationError } from '../types/types';

import { findGameEntry } from '../gameSupport';
import { assertValidationResult, errorHandler } from '../util';

import LoadOrderCollections from '../views/LoadOrderCollections';

async function genCollectionLoadOrder(api: types.IExtensionApi,
                                      gameEntry: ILoadOrderGameInfoExt,
                                      mods: { [modId: string]: types.IMod },
                                      profileId: string,
                                      collection?: types.IMod): Promise<LoadOrder> {
  const state = api.getState();
  let loadOrder: LoadOrder = [];
  try {
    const prev = util.getSafe(state, ['persistent', 'loadOrder', profileId], []);
    loadOrder = await gameEntry.deserializeLoadOrder();
    loadOrder = loadOrder.filter(entry => mods[entry.id]?.type !== 'collection');
    const validRes: IValidationResult = await gameEntry.validate(prev, loadOrder);
    assertValidationResult(validRes);
    if (validRes !== undefined) {
      throw new LoadOrderValidationError(validRes, loadOrder);
    }
  } catch (err) {
    return Promise.reject(err);
  }

  return Promise.resolve(loadOrder);
}

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
    const profileId = selectors.lastActiveProfileForGame(api.getState(), gameEntry.gameId);
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
                             collection: ICollection): Promise<void> {
  const state = api.getState();

  const profileId = selectors.lastActiveProfileForGame(state, gameId);
  if (profileId === undefined) {
    return Promise.reject(new CollectionParseError(collection, 'Invalid profile id'));
  }

  api.store.dispatch(setFBLoadOrder(profileId, collection.loadOrder as any));
  return Promise.resolve(undefined);
}

export function Interface(props: IGameSpecificInterfaceProps): JSX.Element {
  return React.createElement(LoadOrderCollections, (props as any), []);
}
