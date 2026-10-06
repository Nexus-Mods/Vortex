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

// True when none of a game's load orders is the primary or adopts it while the primary order
// holds entries.
export function orphansLegacyOrder(
  entries: readonly IRegisteredLoadOrder[],
  primary: LoadOrder | undefined,
): boolean {
  return (
    hasEntries(primary) &&
    entries.length > 0 &&
    !entries.some((entry) => entry.isPrimary || entry.adoptsLegacyOrder === true)
  );
}
