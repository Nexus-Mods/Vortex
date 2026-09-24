import type { ILookupCalculated } from "../Table";

/**
 * Applies one pass of recalculated table values without modifying the previous ones, which
 * are still in the component's state. Returns `prev` itself when nothing changed.
 */
export function mergeCalculated(
  prev: ILookupCalculated,
  deltas: ILookupCalculated,
  removedIds: string[],
): ILookupCalculated {
  const changedIds = Object.keys(deltas);
  const removed = removedIds.filter((rowId) => prev[rowId] !== undefined);
  if (changedIds.length === 0 && removed.length === 0) {
    return prev;
  }

  // One copy for the whole pass: a copy per changed row is quadratic when every row changes
  const next = { ...prev };
  changedIds.forEach((rowId) => {
    next[rowId] = prev[rowId] === undefined ? deltas[rowId] : { ...prev[rowId], ...deltas[rowId] };
  });
  removed.forEach((rowId) => delete next[rowId]);
  return next;
}
