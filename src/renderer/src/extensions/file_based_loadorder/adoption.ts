import type { IRegisteredLoadOrder, LoadOrder } from "./types/types";

const hasEntries = (loadOrder: LoadOrder | undefined): loadOrder is LoadOrder =>
  Array.isArray(loadOrder) && loadOrder.length > 0;

// The order an adopting load order starts from: a copy of the primary order, taken when the
// adopter is read with no order of its own.
export function adoptedLoadOrder(
  gameEntry: IRegisteredLoadOrder,
  primary: LoadOrder | undefined,
  own: LoadOrder | undefined,
): LoadOrder | undefined {
  if (gameEntry.adoptsLegacyOrder !== true || own !== undefined || !hasEntries(primary)) {
    return undefined;
  }
  return [...primary];
}

// The load order that reads persistent.loadOrder: the game's primary, else its an adopter.
export function legacyOrderOwner(
  entries: readonly IRegisteredLoadOrder[],
): IRegisteredLoadOrder | undefined {
  return (
    entries.find((entry) => entry.isPrimary) ??
    entries.find((entry) => entry.adoptsLegacyOrder === true)
  );
}

// True when a game's load orders leave a populated primary order with no owner.
export function orphansLegacyOrder(
  entries: readonly IRegisteredLoadOrder[],
  primary: LoadOrder | undefined,
): boolean {
  return hasEntries(primary) && entries.length > 0 && legacyOrderOwner(entries) === undefined;
}
