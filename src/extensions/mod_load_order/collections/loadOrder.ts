import React = require('react');
import * as types from '../../../types/api';
import * as util from '../../../util/api';
import * as selectors from '../../../util/selectors';

import { setLoadOrder } from '../../../actions/loadOrder';

import { CollectionGenerateError, CollectionParseError, ICollection, ICollectionLoadOrder } from '../types/collections';
import { ILoadOrder } from '../types/types';

import { genCollectionLoadOrder } from '../util';

import LoadOrderCollections from '../views/LoadOrderCollections';

export async function generate(api: types.IExtensionApi,
                               props: types.IGameSpecificGeneratorProps)
                               : Promise<ICollectionLoadOrder> {
  const { state, gameId, modIds, mods } = props;
  const profileId = selectors.lastActiveProfileForGame(state, gameId);
  if (profileId === undefined) {
    return Promise.reject(new CollectionGenerateError('Invalid profile id'));
  }

  const loadOrder: ILoadOrder = util.getSafe(state,
    ['persistent', 'loadOrder', profileId], undefined);
  if (loadOrder === undefined) {
    // This is theoretically "fine" - the user may have simply
    //  downloaded the mods and immediately created the collection
    //  without actually setting up a load order. Alternatively
    //  the game extension itself might be handling the presort functionality
    //  erroneously. Regardless, the collection creation shouldn't be blocked
    //  by the inexistance of a loadOrder.
    return Promise.resolve(undefined);
  }

  const includedMods = modIds.reduce((accum, iter) => {
    if (mods[iter] !== undefined) {
      accum[iter] = mods[iter];
    }
    return accum;
  }, {});
  const filteredLO: ILoadOrder = genCollectionLoadOrder(loadOrder, includedMods);
  return Promise.resolve({ loadOrder: filteredLO });
}

export async function parser(props: types.IGameSpecificParserProps): Promise<void> {
  const { api, gameId, collection } = props;
  const state = api.getState();

  const profileId = selectors.lastActiveProfileForGame(state, gameId);
  if (profileId === undefined) {
    return Promise.reject(new CollectionParseError(collection, 'Invalid profile id'));
  }

  api.store.dispatch(setLoadOrder(profileId, collection.loadOrder as any));
  return Promise.resolve(undefined);
}

export function Interface(props: types.IGameSpecificInterfaceProps): JSX.Element {
  return React.createElement(LoadOrderCollections, (props as any), []);
}
