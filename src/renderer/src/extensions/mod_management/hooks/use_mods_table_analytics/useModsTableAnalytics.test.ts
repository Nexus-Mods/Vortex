import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { emit } = vi.hoisted(() => ({ emit: vi.fn() }));

vi.mock("@/contexts", () => ({ useMainContext: () => ({ api: { events: { emit } } }) }));

import { useModsTableAnalytics } from "./useModsTableAnalytics.hook";

// --- Helpers ---

const analytics = () => renderHook(() => useModsTableAnalytics()).result.current;

/** The one event sent, as the analytics extension receives it. */
const sent = () => {
  expect(emit).toHaveBeenCalledOnce();
  const [channel, event] = emit.mock.calls[0] as [string, unknown];
  expect(channel).toBe("analytics-track-mixpanel-event");
  return event;
};

const VIEW = { id: "all", label: "All mods", defaults: { grouping: "none", columns: [] } };

// --- Tests ---

describe("useModsTableAnalytics", () => {
  beforeEach(() => {
    emit.mockReset();
  });

  it("reports a built-in view by its id", () => {
    analytics().onViewSelected(VIEW);

    expect(sent()).toEqual({
      eventName: "app_mods_table_view_selected",
      properties: { view: "all" },
    });
  });

  // The name is whatever the user typed, so it stays on their machine.
  it("reports a view of the user's own only as custom", () => {
    analytics().onViewSelected({ ...VIEW, id: "custom-1", label: "My mods", isCustom: true });

    expect(sent()).toEqual({
      eventName: "app_mods_table_view_selected",
      properties: { view: "custom" },
    });
  });

  it("reports how a view changed", () => {
    analytics().onViewChanged("renamed");

    expect(sent()).toEqual({
      eventName: "app_mods_table_view_changed",
      properties: { change: "renamed" },
    });
  });

  it("reports a change of grouping", () => {
    analytics().onGroupingChanged("collection");

    expect(sent()).toEqual({
      eventName: "app_mods_table_grouping_changed",
      properties: { grouping: "collection" },
    });
  });

  it("reports a column shown or hidden", () => {
    analytics().onColumnToggled("version", false);

    expect(sent()).toEqual({
      eventName: "app_mods_table_column_toggled",
      properties: { column: "version", visible: false },
    });
  });

  it("reports a search starting, without what was searched for", () => {
    analytics().onSearchStarted();

    expect(sent()).toEqual({ eventName: "app_mods_table_searched", properties: {} });
  });

  it("reports a context menu opening, on what and from where", () => {
    analytics().onMenuOpen("selection", "keyboard");

    expect(sent()).toEqual({
      eventName: "app_mods_table_menu_opened",
      properties: { target: "selection", via: "keyboard" },
    });
  });
});
