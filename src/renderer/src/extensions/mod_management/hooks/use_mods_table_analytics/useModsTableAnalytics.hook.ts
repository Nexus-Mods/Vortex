import { useMemo } from "react";

import { useMainContext } from "@/contexts";
import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import type { TableMenuTarget } from "@/ui/components/table/Table.types";

import type { IModsTableView, ModsTableGrouping } from "../../util/mods_table_views/modsTableViews";

/**
 * The new Mods table's toolbars, as they name themselves in the shared toolbar events: its
 * head, each row's actions and menu, and the selection bar. Apart from the classic table's
 * `"mods"`, and from each other, as a pin on a row and one on the selection bar differ.
 */
export const MODS_TABLE_TOOLBARS = {
  head: "mods-table",
  row: "mods-table-row",
  selection: "mods-table-selection",
} as const;

/** A group heading's toolbar, named by its view's grouping, e.g. `"mods-table-group-collection"`. */
export const modsTableGroupToolbar = (grouping: string) => `mods-table-group-${grouping}`;

/** How a custom view of the user's own changed. */
export type ModsTableViewChange = "created" | "renamed" | "deleted" | "reset";

/**
 * A view as it's reported: a built-in one by its id, the user's own only as `"custom"`, so
 * the name they gave it never leaves the machine.
 */
const reportedView = (view: IModsTableView): string => (view.isCustom ? "custom" : view.id);

const viewSelectedEvent = (view: IModsTableView): MixpanelEvent => ({
  eventName: "app_mods_table_view_selected",
  properties: { view: reportedView(view) },
});

const viewChangedEvent = (change: ModsTableViewChange): MixpanelEvent => ({
  eventName: "app_mods_table_view_changed",
  properties: { change },
});

const groupingChangedEvent = (grouping: ModsTableGrouping): MixpanelEvent => ({
  eventName: "app_mods_table_grouping_changed",
  properties: { grouping },
});

const columnToggledEvent = (column: string, visible: boolean): MixpanelEvent => ({
  eventName: "app_mods_table_column_toggled",
  properties: { column, visible },
});

const searchedEvent = (): MixpanelEvent => ({
  eventName: "app_mods_table_searched",
  properties: {},
});

const menuOpenedEvent = (target: TableMenuTarget, via: "pointer" | "keyboard"): MixpanelEvent => ({
  eventName: "app_mods_table_menu_opened",
  properties: { target, via },
});

/** Usage tracking for the new Mods table, as callbacks for where each happens. */
export interface IModsTableAnalytics {
  /**
   * A different view opened because of something the user did: picking it, creating it, or
   * deleting the open one, which goes back to the first. Not sent when a view stops being
   * offered, such as Updates once there are none.
   */
  onViewSelected: (view: IModsTableView) => void;
  /** The user created, renamed or deleted a view of their own, or reset a built-in one. */
  onViewChanged: (change: ModsTableViewChange) => void;
  /** The user changed what the mods are grouped by. */
  onGroupingChanged: (grouping: ModsTableGrouping) => void;
  /** The user showed or hid a column. */
  onColumnToggled: (column: string, visible: boolean) => void;
  /** The user started a search; what they searched for is never sent. */
  onSearchStarted: () => void;
  /** A context menu opened. */
  onMenuOpen: (target: TableMenuTarget, via: "pointer" | "keyboard") => void;
}

/**
 * Usage tracking for the new Mods table, in events of its own rather than the classic
 * table's, so its usage reads on its own while it's in beta. Its toolbars report through the
 * shared toolbar events instead, named by {@link MODS_TABLE_TOOLBARS}.
 *
 * None of the events carry game, version or user scope: those are Mixpanel super
 * properties. Nothing the user typed, a view's name or a search, is sent.
 */
export const useModsTableAnalytics = (): IModsTableAnalytics => {
  const { api } = useMainContext();

  return useMemo(() => {
    const send = (event: MixpanelEvent) => api.events.emit("analytics-track-mixpanel-event", event);

    return {
      onViewSelected: (view) => send(viewSelectedEvent(view)),
      onViewChanged: (change) => send(viewChangedEvent(change)),
      onGroupingChanged: (grouping) => send(groupingChangedEvent(grouping)),
      onColumnToggled: (column, visible) => send(columnToggledEvent(column, visible)),
      onSearchStarted: () => send(searchedEvent()),
      onMenuOpen: (target, via) => send(menuOpenedEvent(target, via)),
    };
  }, [api]);
};
