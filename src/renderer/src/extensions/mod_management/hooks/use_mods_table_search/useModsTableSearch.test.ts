import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { IModWithState } from "../../types/IModProps";
import type { IModGroup, IModRow } from "../../util/mods_table_views/modsTableViews";
import type { IModsTableColumn } from "../use_mods_table_columns/useModsTableColumns.hook";
import { useModsTableSearch } from "./useModsTableSearch.hook";

// --- Helpers ---

const row = (id: string, name: string, author = ""): IModRow => ({
  mod: { id, attributes: { name, author } } as IModWithState,
  name,
});

const ALPHA = row("a", "Alpha", "Ann");
const BETA = row("b", "Beta", "Bob");
const ROWS = [ALPHA, BETA];

const GROUPS: IModGroup[] = [
  { id: "first", label: "First", rows: [ALPHA] },
  { id: "second", label: "Second", rows: [BETA] },
];

const NAME = { id: "name", header: "Name", searchText: ({ name }) => name } as IModsTableColumn;
const AUTHOR = {
  id: "author",
  header: "Author",
  searchText: ({ mod }) => mod.attributes?.author ?? "",
} as IModsTableColumn;

const render = ({
  groups,
  visibleColumns = [NAME],
  selected = new Set<string>(),
}: {
  groups?: IModGroup[];
  visibleColumns?: IModsTableColumn[];
  selected?: ReadonlySet<string>;
} = {}) => {
  const setSelected = vi.fn();
  const onSearchStarted = vi.fn();
  const hook = renderHook(() =>
    useModsTableSearch({
      rows: ROWS,
      groups,
      visibleColumns,
      selected,
      setSelected,
      onSearchStarted,
    }),
  );
  return { ...hook, setSelected, onSearchStarted };
};

const ids = (rows: IModRow[]) => rows.map(({ mod }) => mod.id);

// --- Tests ---

describe("useModsTableSearch", () => {
  it("shows every row and group while there's nothing to search for", () => {
    const { result } = render({ groups: GROUPS });

    expect(result.current.isSearching).toBe(false);
    expect(result.current.shownRows).toBe(ROWS);
    expect(result.current.shownGroups).toBe(GROUPS);
  });

  it("shows the rows whose shown columns have the text, ignoring case", () => {
    const { result } = render({ visibleColumns: [NAME, AUTHOR] });

    act(() => result.current.changeSearch("BOB"));

    expect(result.current.isSearching).toBe(true);
    expect(ids(result.current.shownRows)).toEqual(["b"]);
  });

  it("doesn't search a hidden column", () => {
    const { result } = render();

    act(() => result.current.changeSearch("bob"));

    expect(result.current.shownRows).toEqual([]);
  });

  it("drops a group with no rows left", () => {
    const { result } = render({ groups: GROUPS });

    act(() => result.current.changeSearch("alp"));

    expect(result.current.shownGroups?.map(({ id }) => id)).toEqual(["first"]);
  });

  it("counts a search as started only from an empty box", () => {
    const { result, onSearchStarted } = render();

    act(() => result.current.changeSearch("a"));
    act(() => result.current.changeSearch("al"));

    expect(onSearchStarted).toHaveBeenCalledTimes(1);
  });

  it("deselects the mods a search hides", () => {
    const { result, setSelected } = render({ selected: new Set(["a", "b"]) });

    act(() => result.current.changeSearch("alpha"));

    expect(setSelected).toHaveBeenCalledWith(new Set(["a"]));
  });

  it("leaves the selection alone as a search is cleared", () => {
    const { result, setSelected } = render({ selected: new Set(["a"]) });

    act(() => result.current.changeSearch(""));

    expect(setSelected).not.toHaveBeenCalled();
  });
});
