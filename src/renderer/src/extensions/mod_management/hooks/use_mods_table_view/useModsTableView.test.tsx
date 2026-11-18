import { act, renderHook } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { emit } = vi.hoisted(() => ({
  emit: vi.fn<(channel: string, event: MixpanelEvent) => void>(),
}));

vi.mock("@/contexts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useMainContext: () => ({ api: { events: { emit } } }),
}));

import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import { makeModsTableStore } from "@/test-utils/modsTableStore";

import { BY_NAME } from "../../util/mods_table_views/modsTableViews";
import { useModsTableView } from "./useModsTableView.hook";

// --- Helpers ---

const NO_DEFAULTS: string[] = [];

/** The columns the table has, its own and the extensions' the game offers. */
const TABLE_COLUMNS: ReadonlySet<string> = new Set(["name", "version", "author", "endorsed"]);

const renderView = (
  defaultShown: readonly string[] = NO_DEFAULTS,
  columnIds: ReadonlySet<string> = TABLE_COLUMNS,
) => {
  const store = makeModsTableStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return renderHook(() => useModsTableView({ mods: {}, defaultShown, columnIds }), { wrapper })
    .result;
};

/** The properties of each analytics event sent with this name, in order. */
const sent = (eventName: string) =>
  emit.mock.calls
    .filter(
      ([channel, event]) =>
        channel === "analytics-track-mixpanel-event" && event.eventName === eventName,
    )
    .map(([, event]) => event.properties);

// --- Tests ---

describe("useModsTableView", () => {
  beforeEach(() => {
    emit.mockReset();
  });

  // Extensions' columns, which say for themselves whether they start shown.
  describe("columns shown by default", () => {
    const EXTENSION_COLUMNS = ["endorsed"];

    it("shows them in every view, the user's own too, and the view's own choice of the rest", () => {
      const result = renderView(EXTENSION_COLUMNS);

      expect(result.current.isColumnShown("endorsed")).toBe(true);
      expect(result.current.isColumnShown("author")).toBe(false);

      act(() => result.current.select("status"));
      expect(result.current.isColumnShown("endorsed")).toBe(true);

      act(() => result.current.addView("Mine", "picker"));
      expect(result.current.isColumnShown("endorsed")).toBe(true);
    });

    it("hides one the user hides, keeping it hidden through a reset without offering one", () => {
      const result = renderView(EXTENSION_COLUMNS);

      act(() => result.current.setColumnVisible("endorsed", false));
      expect(result.current.isColumnShown("endorsed")).toBe(false);
      expect(result.current.canReset).toBe(false);

      act(() => result.current.setGrouping("author"));
      act(() => result.current.reset("panel"));
      expect(result.current.isColumnShown("endorsed")).toBe(false);
    });
  });

  describe("column widths", () => {
    it("keeps a column's width to the open view", () => {
      const result = renderView();

      act(() => result.current.setColumnWidths({ author: 240 }));
      expect(result.current.columnWidths).toEqual({ author: 240 });

      act(() => result.current.select("status"));
      expect(result.current.columnWidths).toEqual({});
    });

    it("keeps widths through a reset, and doesn't offer one for them alone", () => {
      const result = renderView();

      act(() => result.current.setColumnWidths({ author: 240 }));
      expect(result.current.canReset).toBe(false);

      act(() => result.current.setGrouping("author"));
      act(() => result.current.reset("panel"));

      expect(result.current.grouping).toBe("none");
      expect(result.current.columnWidths).toEqual({ author: 240 });
    });
  });

  describe("sort", () => {
    const BY_VERSION = { columnId: "version", direction: "descending" } as const;

    it("starts every view sorted by name, A to Z", () => {
      const result = renderView();

      expect(result.current.sort).toEqual(BY_NAME);
    });

    it("keeps a sort to its view, without offering a reset for it", () => {
      const result = renderView();

      act(() => result.current.setSort(BY_VERSION));
      expect(result.current.sort).toEqual(BY_VERSION);
      expect(result.current.canReset).toBe(false);

      act(() => result.current.select("status"));
      expect(result.current.sort).toEqual(BY_NAME);

      act(() => result.current.select("all"));
      expect(result.current.sort).toEqual(BY_VERSION);
    });

    it("keeps a sort through a reset, as it keeps widths", () => {
      const result = renderView();
      act(() => result.current.setSort(BY_VERSION));
      act(() => result.current.setGrouping("author"));

      act(() => result.current.reset("edited_strip"));

      expect(result.current.grouping).toBe("none");
      expect(result.current.sort).toEqual(BY_VERSION);
      expect(result.current.canReset).toBe(false);
    });
  });

  describe("a new view", () => {
    it("makes it from what's showing, leaving the view it came from edited", () => {
      const result = renderView();
      const sort = { columnId: "version", direction: "descending" } as const;
      act(() => result.current.setGrouping("author"));
      act(() => result.current.setColumnVisible("version", false));
      act(() => result.current.setSort(sort));
      act(() => result.current.setColumnWidths({ name: 300 }));

      act(() => result.current.addView("Mine", "edited_strip"));

      expect(result.current.view.label).toBe("Mine");
      expect(result.current.grouping).toBe("author");
      expect(result.current.isColumnShown("version")).toBe(false);
      expect(result.current.sort).toEqual(sort);
      expect(result.current.columnWidths).toEqual({ name: 300 });

      act(() => result.current.select("all"));
      expect(result.current.canReset).toBe(true);
    });
  });

  describe("filters", () => {
    it("starts every view unfiltered and unedited", () => {
      const result = renderView();

      expect(result.current.filters).toEqual({ status: [] });
      expect(result.current.isEdited).toBe(false);
    });

    it("reads a view saved before filters as unfiltered and unedited", () => {
      const store = makeModsTableStore({
        views: { changes: { all: { columns: { version: false } } }, custom: [] },
      });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      );
      const { result } = renderHook(
        () => useModsTableView({ mods: {}, defaultShown: NO_DEFAULTS, columnIds: TABLE_COLUMNS }),
        {
          wrapper,
        },
      );

      expect(result.current.filters).toEqual({ status: [] });
      expect(result.current.isEdited).toBe(false);
    });

    it("keeps filters to their view, editing a built-in one", () => {
      const result = renderView();

      act(() => result.current.setFilters({ status: ["enabled"] }));
      expect(result.current.filters).toEqual({ status: ["enabled"] });
      expect(result.current.changedFilters).toEqual(["status"]);
      expect(result.current.isEdited).toBe(true);
      expect(result.current.canReset).toBe(false);

      act(() => result.current.select("status"));
      expect(result.current.filters).toEqual({ status: [] });
    });

    it("never edits the user's own view", () => {
      const result = renderView();
      act(() => result.current.addView("Mine", "picker"));

      act(() => result.current.setFilters({ status: ["enabled"] }));

      expect(result.current.filters).toEqual({ status: ["enabled"] });
      expect(result.current.isEdited).toBe(false);
    });

    it("puts filters back from a reset, keeping the grouping", () => {
      const result = renderView();
      act(() => result.current.setGrouping("author"));
      act(() => result.current.setFilters({ status: ["enabled"] }));

      act(() => result.current.resetFilters("edited_strip"));

      expect(result.current.filters).toEqual({ status: [] });
      expect(result.current.isEdited).toBe(false);
      expect(result.current.grouping).toBe("author");
    });

    it("moves a built-in view's filters into a new view, as Browse does", () => {
      const result = renderView();
      act(() => result.current.setFilters({ status: ["disabled"] }));

      act(() => result.current.addView("Mine", "edited_strip"));
      expect(result.current.filters).toEqual({ status: ["disabled"] });

      act(() => result.current.select("all"));
      expect(result.current.filters).toEqual({ status: [] });
      expect(result.current.isEdited).toBe(false);
    });
  });

  describe("filters suspended for a visit", () => {
    it("shows every mod without changing what the view saves, until the view changes", () => {
      const result = renderView();
      act(() => result.current.setFilters({ status: ["disabled"] }));

      act(() => result.current.suspendFilters());
      expect(result.current.filters).toEqual({ status: [] });
      expect(result.current.isEdited).toBe(false);

      act(() => result.current.select("status"));
      act(() => result.current.select("all"));
      expect(result.current.filters).toEqual({ status: ["disabled"] });
    });

    it("makes a new view from what's shown, leaving the built-in view's saved filters", () => {
      const result = renderView();
      act(() => result.current.setFilters({ status: ["disabled"] }));
      act(() => result.current.suspendFilters());

      act(() => result.current.addView("Mine", "picker"));
      expect(result.current.filters).toEqual({ status: [] });

      act(() => result.current.select("all"));
      expect(result.current.filters).toEqual({ status: ["disabled"] });
    });

    it("reports a tick against what's shown", () => {
      const result = renderView();
      act(() => result.current.setFilters({ status: ["disabled"] }));
      act(() => result.current.suspendFilters());
      emit.mockReset();

      act(() => result.current.setFilters({ status: ["disabled"] }));

      expect(sent("app_mods_table_filter_changed")).toEqual([
        { filter: "status", values: ["disabled"] },
      ]);
    });
  });

  describe("tracking", () => {
    it("reports a sort only when it changes", () => {
      const result = renderView();
      const byVersion = { columnId: "version", direction: "descending" } as const;

      act(() => result.current.setSort(byVersion));
      act(() => result.current.setSort(byVersion));

      expect(sent("app_mods_table_sort_changed")).toEqual([
        { column: "version", direction: "descending" },
      ]);
    });

    it("reports a filter change with every value ticked", () => {
      const result = renderView();
      act(() => result.current.setFilters({ status: ["enabled"] }));
      act(() => result.current.setFilters({ status: ["enabled", "uninstalled"] }));
      act(() => result.current.setFilters({ status: ["enabled", "uninstalled"] }));

      expect(sent("app_mods_table_filter_changed")).toEqual([
        { filter: "status", values: ["enabled"] },
        { filter: "status", values: ["enabled", "uninstalled"] },
      ]);
    });

    it("reports a reset with where it came from", () => {
      const result = renderView();
      act(() => result.current.setGrouping("author"));

      act(() => result.current.reset("edited_strip"));

      expect(sent("app_mods_table_view_changed")).toEqual([
        { change: "reset", source: "edited_strip" },
      ]);
    });

    it("reports a column only when it's shown or hidden", () => {
      const result = renderView();
      const [column] = result.current.view.defaults.columns;

      act(() => result.current.setColumnVisible(column, true));
      act(() => result.current.setColumnVisible(column, false));
      act(() => result.current.setColumnVisible(column, false));

      expect(sent("app_mods_table_column_toggled")).toEqual([{ column, visible: false }]);
    });

    it("reports a new view as selected, as it opens in it", () => {
      const result = renderView();

      act(() => result.current.addView("Mine", "picker"));

      expect(result.current.view.label).toBe("Mine");
      expect(sent("app_mods_table_view_changed")).toEqual([
        { change: "created", source: "picker" },
      ]);
      expect(sent("app_mods_table_view_selected")).toEqual([{ view: "custom" }]);
    });

    it("reports the first view as selected when the open one is deleted", () => {
      const result = renderView();
      const first = result.current.views[0];
      act(() => result.current.addView("Mine", "picker"));
      emit.mockReset();

      act(() => result.current.removeView(result.current.view.id));

      expect(result.current.view.id).toBe(first.id);
      expect(sent("app_mods_table_view_selected")).toEqual([{ view: first.id }]);
    });

    it("doesn't report a view as selected when one that isn't open is deleted", () => {
      const result = renderView();
      act(() => result.current.addView("Mine", "picker"));
      const mine = result.current.view.id;
      act(() => result.current.select(result.current.views[0].id));
      emit.mockReset();

      act(() => result.current.removeView(mine));

      expect(sent("app_mods_table_view_selected")).toEqual([]);
    });
  });
});
