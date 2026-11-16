import { useMemo, useState, useSyncExternalStore } from "react";

import type { IModGroup, IModRow } from "../../util/mods_table_views/modsTableViews";
import type { IModsTableColumn } from "../use_mods_table_columns/useModsTableColumns.hook";

/**
 * Whether a row shows the text searched for, ignoring case, in any of the columns' cells;
 * undefined while there's nothing to search for.
 */
const searchFilter = (columns: IModsTableColumn[], search: string) => {
  const query = search.trim().toLocaleLowerCase();

  if (query === "") {
    return undefined;
  }

  return (row: IModRow) =>
    columns.some((column) => column.searchText?.(row).toLocaleLowerCase().includes(query));
};

/** Says when columns' search texts change apart from their rows, such as an extension's values. */
export interface ISearchTextChanges {
  /** Calls `onChange` as the texts change, until the function it returns is called. */
  subscribe: (onChange: () => void) => () => void;
  /** A number that moves on with each change. */
  revision: () => number;
}

const NOT_LISTENING = () => () => undefined;
const NO_REVISION = () => 0;

interface IModsTableSearchOptions {
  /** Every mod's row, for the flat list. */
  rows: IModRow[];
  /** The table's groups, or undefined while it isn't grouped. */
  groups: IModGroup[] | undefined;
  /** The columns shown, so a search finds only what's on screen. */
  visibleColumns: IModsTableColumn[];
  /** The selected mods' ids. */
  selected: ReadonlySet<string>;
  /** Replaces the selection, as a search deselects the mods it hides. */
  setSelected: (ids: ReadonlySet<string>) => void;
  /** Called as a search starts from an empty box. */
  onSearchStarted: () => void;
  /** Says when the columns' texts change apart from the rows, to search again. */
  textChanges?: ISearchTextChanges;
}

/**
 * The table's search, and the rows and groups it leaves. A group with none left is dropped,
 * as its row would stand for nothing.
 */
export const useModsTableSearch = ({
  rows,
  groups,
  visibleColumns,
  selected,
  setSelected,
  onSearchStarted,
  textChanges,
}: IModsTableSearchOptions) => {
  const [search, setSearch] = useState("");
  const isQuery = search.trim() !== "";

  // Only while searching, as nothing else reads the texts.
  const textRevision = useSyncExternalStore(
    isQuery && textChanges ? textChanges.subscribe : NOT_LISTENING,
    textChanges?.revision ?? NO_REVISION,
  );

  const searchColumns = useMemo(
    () => visibleColumns.filter((column) => column.searchText !== undefined),
    [visibleColumns],
  );
  const matches = useMemo(
    () => searchFilter(searchColumns, search),
    // With the revision too, as the columns read texts that change apart from them.
    [search, searchColumns, textRevision],
  );
  const shownRows = useMemo(() => (matches ? rows.filter(matches) : rows), [matches, rows]);
  const shownGroups = useMemo(
    () =>
      matches && groups
        ? groups
            .map((group) => ({ ...group, rows: group.rows.filter(matches) }))
            .filter((group) => group.rows.length > 0)
        : groups,
    [groups, matches],
  );

  // A selected mod the search hides is deselected, so nothing acts on a mod out of sight.
  const changeSearch = (next: string) => {
    if (search.trim() === "" && next.trim() !== "") {
      onSearchStarted();
    }
    setSearch(next);

    const nextMatches = searchFilter(searchColumns, next);
    if (nextMatches !== undefined) {
      setSelected(
        new Set(
          rows
            .filter((row) => selected.has(row.mod.id) && nextMatches(row))
            .map(({ mod }) => mod.id),
        ),
      );
    }
  };

  return {
    search,
    setSearch,
    changeSearch,
    isSearching: matches !== undefined,
    shownRows,
    shownGroups,
  };
};
