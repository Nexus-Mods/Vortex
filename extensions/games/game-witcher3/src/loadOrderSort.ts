import { types } from "@nexusmods/vortex-api";

import { withPositionPrefix } from "./collectionLoadOrder";
import { isLockedEntry } from "./common";

/** Locked entries first, the rest by folder name (the game's fallback order). */
export function sortLoadOrderAlphabetically<T extends types.ILoadOrderEntry>(loadOrder: T[]): T[] {
  const locked = loadOrder.filter((entry) => isLockedEntry(entry.id));
  const rest = loadOrder
    .filter((entry) => !isLockedEntry(entry.id))
    .sort((lhs, rhs) => lhs.id.toLowerCase().localeCompare(rhs.id.toLowerCase()));
  return withPositionPrefix([...locked, ...rest]);
}
