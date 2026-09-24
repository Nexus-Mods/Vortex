import type { ILookupCalculated } from "../Table";

/**
 * Applies one pass of recalculated table values without modifying the previous ones, which
 * are still in the component's state. Returns `prev` itself when nothing changed.
 *
 * Adding or removing a row therefore gives a new cache, which the table commits with one more
 * render. That render isn't what shows the row: `refreshSorted` already does.
 *
 * A row whose delta repeats every one of its values (compared with `===`, as
 * immutability-helper's `$merge` did) keeps its object, so its TableRow doesn't re-render.
 */
export function mergeCalculated(
  prev: ILookupCalculated,
  deltas: ILookupCalculated,
  removedIds: string[],
): ILookupCalculated {
  // One copy for the whole pass, made on the first change: a copy per changed row is
  // quadratic when every row changes
  let next: ILookupCalculated | undefined;
  const writable = (): ILookupCalculated => {
    next = next ?? { ...prev };
    return next;
  };

  Object.keys(deltas).forEach((rowId) => {
    const row = prev[rowId];
    const delta = deltas[rowId];
    if (row === undefined) {
      writable()[rowId] = delta;
    } else if (Object.keys(delta).some((key) => delta[key] !== row[key])) {
      writable()[rowId] = { ...row, ...delta };
    }
  });
  removedIds
    .filter((rowId) => prev[rowId] !== undefined)
    .forEach((rowId) => delete writable()[rowId]);

  return next ?? prev;
}
