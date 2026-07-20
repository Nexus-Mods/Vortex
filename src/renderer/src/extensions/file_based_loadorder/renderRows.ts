import type { IItemRendererProps, LoadOrder } from "./types/types";
import { isEntryLocked } from "./util";

type InvalidEntries = IItemRendererProps["invalidEntries"];

/**
 * Memoizes the per-row props for the load order page. The full-list build is
 * cached on (loadOrder, invalid, toggleable) and the filter separately on the
 * filter text, so an unrelated re-render reuses the same row objects (keeping
 * the rows' React.memo intact) and the filter only recomputes on a keystroke.
 * Row position is 1-based over the full order, computed before filtering.
 */
export class RenderRowsCache {
  #rows:
    | {
        loadOrder: LoadOrder;
        invalid: InvalidEntries;
        toggleable: boolean;
        result: IItemRendererProps[];
      }
    | undefined;
  #filtered:
    | { rows: IItemRendererProps[]; filterText: string; result: IItemRendererProps[] }
    | undefined;

  public build(
    loadOrder: LoadOrder,
    invalid: InvalidEntries,
    toggleable: boolean,
    filterText: string,
  ): IItemRendererProps[] {
    const cache = this.#rows;
    let rows: IItemRendererProps[];
    if (
      cache !== undefined &&
      cache.loadOrder === loadOrder &&
      cache.invalid === invalid &&
      cache.toggleable === toggleable
    ) {
      rows = cache.result;
    } else {
      const lockedEntriesCount = loadOrder.filter((entry) => isEntryLocked(entry.locked)).length;
      rows = loadOrder.map(
        (loEntry, idx): IItemRendererProps => ({
          loEntry,
          displayCheckboxes: toggleable,
          invalidEntries: invalid,
          position: idx + 1,
          lockedEntriesCount,
        }),
      );
      this.#rows = { loadOrder, invalid, toggleable, result: rows };
    }

    if (filterText === "") {
      return rows;
    }
    const filtered = this.#filtered;
    if (filtered !== undefined && filtered.rows === rows && filtered.filterText === filterText) {
      return filtered.result;
    }
    const lower = filterText.toLowerCase();
    const result = rows.filter((row) =>
      (row.loEntry.name ?? row.loEntry.id).toLowerCase().includes(lower),
    );
    this.#filtered = { rows, filterText, result };
    return result;
  }
}
