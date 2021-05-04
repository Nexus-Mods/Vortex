import * as types from '../../types/api';
import * as util from '../../util/api';
import { ILoadOrder, ILoadOrderEntry } from './types/types';

export function isModInCollection(collection: types.IMod, mod: types.IMod) {
  if (collection.rules === undefined) {
    return false;
  }

  return collection.rules.find(rule =>
    util.testModReference(mod, rule.reference)) !== undefined;
}

export function isValidMod(mod: types.IMod) {
  return (mod !== undefined) && (mod.type !== 'collection');
}

export function genCollectionLoadOrder(loadOrder: { [modId: string]: ILoadOrderEntry },
                                       mods: { [modId: string]: types.IMod },
                                       collection?: types.IMod): ILoadOrder {
  const sortedMods = Object.keys(loadOrder)
    .filter(id => {
      return (collection !== undefined)
        ? isValidMod(mods[id]) && (isModInCollection(collection, mods[id]))
        : isValidMod(mods[id]);
    })
    .sort((lhs, rhs) => loadOrder[lhs].pos - loadOrder[rhs].pos)
    .reduce((accum, iter, idx) => {
      accum[iter] = {
        ...loadOrder[iter],
        pos: idx,
      };
      return accum;
    }, {});
  return sortedMods;
}
