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

import { useModsTableView } from "./useModsTableView.hook";

// --- Helpers ---

const renderView = () => {
  const store = makeModsTableStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return renderHook(() => useModsTableView({}), { wrapper }).result;
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

  describe("tracking", () => {
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

      act(() => result.current.addView("Mine"));

      expect(result.current.view.label).toBe("Mine");
      expect(sent("app_mods_table_view_changed")).toEqual([{ change: "created" }]);
      expect(sent("app_mods_table_view_selected")).toEqual([{ view: "custom" }]);
    });

    it("reports the first view as selected when the open one is deleted", () => {
      const result = renderView();
      const first = result.current.views[0];
      act(() => result.current.addView("Mine"));
      emit.mockReset();

      act(() => result.current.removeView(result.current.view.id));

      expect(result.current.view.id).toBe(first.id);
      expect(sent("app_mods_table_view_selected")).toEqual([{ view: first.id }]);
    });

    it("doesn't report a view as selected when one that isn't open is deleted", () => {
      const result = renderView();
      act(() => result.current.addView("Mine"));
      const mine = result.current.view.id;
      act(() => result.current.select(result.current.views[0].id));
      emit.mockReset();

      act(() => result.current.removeView(mine));

      expect(sent("app_mods_table_view_selected")).toEqual([]);
    });
  });
});
