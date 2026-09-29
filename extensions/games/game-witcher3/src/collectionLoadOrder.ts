import { types, util } from "@nexusmods/vortex-api";

import { LOCKED_PREFIX } from "./common";

export function isValidMod(mod: types.IMod) {
  return mod !== undefined && mod.type !== "collection";
}

export function isModInCollection(collectionMod: types.IMod, mod: types.IMod) {
  if (collectionMod.rules === undefined) {
    return false;
  }

  return (
    collectionMod.rules.find((rule) => util.testModReference(mod, rule.reference)) !== undefined
  );
}

/**
 * Stamps each entry's position as `data.prefix`. Nothing here reads it, but older
 * versions of this extension share the same state and sort by it unguarded.
 */
export function withPositionPrefix<T extends types.ILoadOrderEntry>(entries: T[]): T[] {
  return entries.map((entry, position) => ({
    ...entry,
    data: { ...entry.data, prefix: position },
  }));
}

/**
 * Reduces the profile's load order down to the entries a collection should
 * carry. The array order is the load order, so the entries are kept in the
 * order they arrive in.
 */
export function genCollectionLoadOrder(
  loadOrder: types.IFBLOLoadOrderEntry[],
  mods: Record<string, types.IMod>, // key: mod id
  collection?: types.IMod,
): types.LoadOrder {
  return withPositionPrefix(
    loadOrder.filter((entry) => {
      const modId = entry.modId;
      if (modId === undefined) {
        return false;
      }
      if (modId.includes(LOCKED_PREFIX)) {
        return true;
      }
      return collection !== undefined
        ? isValidMod(mods[modId]) && isModInCollection(collection, mods[modId])
        : isValidMod(mods[modId]);
    }),
  );
}
