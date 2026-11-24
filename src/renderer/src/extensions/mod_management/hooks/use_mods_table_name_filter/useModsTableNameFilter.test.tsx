import { act, renderHook } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { setAttributeFilter } from "@/actions/tables";
import { makeModsTableStore } from "@/test-utils/modsTableStore";

import { useModsTableNameFilter } from "./useModsTableNameFilter.hook";

const render = (nameFilter?: string, newTableShown = true) => {
  const store = makeModsTableStore({
    tables: nameFilter === undefined ? {} : { mods: { filter: { name: nameFilter } } },
  });
  const setSearch = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  renderHook(() => useModsTableNameFilter(setSearch, newTableShown), { wrapper });

  const nameFilterLeft = (): unknown => store.getState().settings.tables.mods?.filter?.name;
  return { store, setSearch, nameFilterLeft };
};

describe("useModsTableNameFilter", () => {
  it("searches the table for the legacy table's name filter, then clears the filter", () => {
    const { setSearch, nameFilterLeft } = render("SkyUI");

    expect(setSearch).toHaveBeenCalledTimes(1);
    expect(setSearch).toHaveBeenCalledWith("SkyUI");
    expect(nameFilterLeft()).toBeUndefined();
  });

  it("searches again when the same name is filtered for again", () => {
    const { store, setSearch } = render("SkyUI");

    act(() => {
      store.dispatch(setAttributeFilter("mods", "name", "SkyUI"));
    });

    expect(setSearch).toHaveBeenCalledTimes(2);
  });

  it("leaves the name filter to the legacy table while the new table isn't shown", () => {
    const { setSearch, nameFilterLeft } = render("SkyUI", false);

    expect(setSearch).not.toHaveBeenCalled();
    expect(nameFilterLeft()).toBe("SkyUI");
  });

  it("leaves the search alone without a name filter", () => {
    const { setSearch } = render();

    expect(setSearch).not.toHaveBeenCalled();
  });
});
