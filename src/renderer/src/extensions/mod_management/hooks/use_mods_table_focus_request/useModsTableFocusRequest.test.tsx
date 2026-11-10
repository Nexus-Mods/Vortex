import { renderHook } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

import { makeModsTableStore } from "@/test-utils/modsTableStore";

import type { IModGroup, IModRow } from "../../util/mods_table_views/modsTableViews";
import { useModsTableFocusRequest } from "./useModsTableFocusRequest.hook";

// --- Helpers ---

const group = (id: string) => ({ id }) as IModGroup;

const row = (id: string) => ({ mod: { id } }) as IModRow;

const render = ({
  focusedGroupId,
  focusedModId,
  groups,
  rows = [],
  search = "",
}: {
  focusedGroupId?: string;
  focusedModId?: string;
  groups: IModGroup[] | undefined;
  rows?: IModRow[];
  search?: string;
}) => {
  const store = makeModsTableStore({ focusedGroupId, focusedModId });
  const setSearch = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const hook = renderHook(() => useModsTableFocusRequest({ groups, rows, search, setSearch }), {
    wrapper,
  });

  return {
    ...hook,
    store,
    setSearch,
    requested: () => store.getState().session.mods.focusedGroupId,
    requestedMod: () => store.getState().session.mods.focusedModId,
  };
};

// --- Tests ---

describe("useModsTableFocusRequest", () => {
  it("returns the group asked for", () => {
    const { result } = render({ focusedGroupId: "a", groups: [group("a")] });

    expect(result.current.focusGroupId).toBe("a");
  });

  it("drops the request once the group has been shown", () => {
    const { result, requested } = render({ focusedGroupId: "a", groups: [group("a")] });

    result.current.onGroupFocused();

    expect(requested()).toBeUndefined();
  });

  it("clears a search once for a new request", () => {
    const { rerender, setSearch } = render({
      focusedGroupId: "a",
      groups: [group("a")],
      search: "skyrim",
    });

    rerender();

    expect(setSearch).toHaveBeenCalledTimes(1);
    expect(setSearch).toHaveBeenCalledWith("");
  });

  it("drops a request no group answers", () => {
    const { requested } = render({ focusedGroupId: "b", groups: [group("a")] });

    expect(requested()).toBeUndefined();
  });

  it("drops a request while there are no groups", () => {
    const { requested } = render({ focusedGroupId: "a", groups: undefined });

    expect(requested()).toBeUndefined();
  });

  it("leaves a request a group answers", () => {
    const { requested } = render({ focusedGroupId: "a", groups: [group("a")] });

    expect(requested()).toBe("a");
  });

  describe("for a mod", () => {
    it("returns the mod asked for, and drops it once shown", () => {
      const { result, requestedMod } = render({
        focusedModId: "skyui",
        groups: undefined,
        rows: [row("skyui")],
      });

      expect(result.current.focusModId).toBe("skyui");

      result.current.onModFocused();

      expect(requestedMod()).toBeUndefined();
    });

    it("clears a search once for a new request", () => {
      const { setSearch } = render({
        focusedModId: "skyui",
        groups: undefined,
        rows: [row("skyui")],
        search: "skse",
      });

      expect(setSearch).toHaveBeenCalledWith("");
    });

    it("drops a request for a mod the table doesn't have", () => {
      const { requestedMod } = render({
        focusedModId: "skyui",
        groups: undefined,
        rows: [row("skse")],
      });

      expect(requestedMod()).toBeUndefined();
    });
  });
});
