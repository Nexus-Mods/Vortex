import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { EditedViewStrip } from "@/ui/components/edited_view_strip/EditedViewStrip";
import { FilterChip } from "@/ui/components/filters/filter_chip/FilterChip";
import { FilterMenu } from "@/ui/components/filters/filter_menu/FilterMenu";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { ToolbarSearch } from "@/ui/components/toolbar/toolbar_search/ToolbarSearch";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import type { IToolbarPanelHandle } from "@/ui/components/toolbar/ToolbarPanelButton";
import { useToolbarAnalytics } from "@/ui/components/toolbar/useToolbarAnalytics.hook";
import { DeleteViewModal } from "@/ui/components/view_picker/delete_view_modal/DeleteViewModal";
import { ViewNameModal } from "@/ui/components/view_picker/view_name_modal/ViewNameModal";
import { type IViewPickerView, ViewPicker } from "@/ui/components/view_picker/ViewPicker";

import {
  MODS_TABLE_TOOLBARS,
  type ModsTableViewSource,
} from "../../hooks/use_mods_table_analytics/useModsTableAnalytics.hook";
import type { IModsTableFilters } from "../../util/mods_table_filters/modsTableFilters";
import type { IModsTableView } from "../../util/mods_table_views/modsTableViews";
import { ModsTableStatusMenu } from "../mods_table_filters/ModsTableStatusMenu";

/** Where the new Mods table's users tell us what they think of it, while it's in beta. */
export const MODS_TABLE_FEEDBACK_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeQgFzQQjWgVGwsFOC22JL2KZpKcKltN6_narrxyxUYydChxQ/viewform";

interface IModsTableToolbarProps {
  /** The views to offer: the built-in ones, then the user's own. */
  views: IModsTableView[];
  /** The open view's id. */
  selectedView: string;
  /** Opens a view, by id. */
  onSelectView: (viewId: string) => void;
  /** Makes a view of the user's own from what's showing, by name, and opens it, from `source`. */
  onAddView: (name: string, source: ModsTableViewSource) => void;
  /** Renames a view of the user's own, by id. */
  onRenameView: (viewId: string, name: string) => void;
  /** Deletes a view of the user's own, by id. */
  onRemoveView: (viewId: string) => void;
  /** Which mods the open view shows. */
  filters: IModsTableFilters;
  /** Which of its filters differ from the view's defaults; none on the user's own. */
  changedFilters: Array<keyof IModsTableFilters>;
  /** Whether the open view's filters differ from its defaults; only a built-in one's can. */
  isEdited: boolean;
  /** Changes some of the open view's filters. */
  onFiltersChange: (change: Partial<IModsTableFilters>) => void;
  /** Puts the given filters, or all of them, back as the open view has them; `source` says how. */
  onResetFilters: (
    source: ModsTableViewSource,
    keys: Array<keyof IModsTableFilters> | undefined,
  ) => void;
  /** The view options' toolbar action, opening its panel. */
  displayOptions: IToolbarAction;
  /** The text the rows are filtered by. */
  search: string;
  /** Filters the rows by what's typed into the search. */
  onSearchChange: (search: string) => void;
  /** Whether the Properties panel is open beside the table. */
  propertiesOpen: boolean;
  /** Opens or closes the Properties panel. */
  onToggleProperties: () => void;
}

/**
 * The new Mods table's views and actions, in its sticky head: its views in a
 * `ViewPicker`, the user's own with a menu to rename, edit or delete them. On the right,
 * the Status filter's chip while it narrows the mods, the feedback form, the filter menu, the view
 * options, the search, then the Properties panel's toggle. Below, while a built-in view's filters
 * are changed, the bar to reset them or save the view as a new one, as the picker's add does.
 */
export const ModsTableToolbar = ({
  views,
  selectedView,
  onSelectView,
  onAddView,
  onRenameView,
  onRemoveView,
  filters,
  changedFilters,
  isEdited,
  onFiltersChange,
  onResetFilters,
  displayOptions,
  search,
  onSearchChange,
  propertiesOpen,
  onToggleProperties,
}: IModsTableToolbarProps) => {
  const { t } = useTranslation("mod_management");
  const [naming, setNaming] = useState<IModsTableView | ModsTableViewSource>();
  const [deleting, setDeleting] = useState<IModsTableView>();
  const optionsPanelRef = useRef<IToolbarPanelHandle>(null);
  const tracking = useToolbarAnalytics(MODS_TABLE_TOOLBARS.head);
  const [optionsFor, setOptionsFor] = useState<string>();

  const open = views.find((view) => view.id === selectedView);
  const changedCount = changedFilters.length;

  /** The Status choices, with a reset only from the Filter menu, as Browse's chips have none. */
  const statusMenu = (onSelect: () => void, fromFilterMenu?: { onClose: () => void }) => (
    <ModsTableStatusMenu
      status={filters.status}
      onChange={(status) => onFiltersChange({ status })}
      onClose={fromFilterMenu?.onClose}
      onReset={
        fromFilterMenu && changedFilters.includes("status")
          ? () => onResetFilters("filter_menu", ["status"])
          : undefined
      }
      onSelect={onSelect}
    />
  );

  const actions: IToolbarAction[] = [
    {
      id: "feedback",
      label: t("modsTable::toolbar::giveFeedback"),
      testId: "mods-table-feedback",
      icon: "rate_review",
      onClick: () => window.api.shell.openUrl(MODS_TABLE_FEEDBACK_URL),
    },
    {
      id: "filter",
      label: t("modsTable::filters::filter"),
      icon: "filter_list",
      testId: "mods-table-filter",
      panelRole: "menu",
      panel: ({ dismiss }) => (
        <FilterMenu
          comingSoon={t("modsTable::filters::comingSoon")}
          items={[
            {
              label: t("modsTable::filters::status"),
              icon: "toggle_on",
              panel: ({ close, dismiss: dismissAll }) => statusMenu(dismissAll, { onClose: close }),
            },
          ]}
          label={t("modsTable::filters::filter")}
          resetLabel={t("modsTable::filters::resetCount", { count: changedCount })}
          onReset={changedCount ? () => onResetFilters("filter_menu", undefined) : undefined}
          onSelect={dismiss}
        />
      ),
    },
    {
      ...displayOptions,
      id: "view-options",
      testId: "mods-table-view-options",
      panelHandle: optionsPanelRef,
    },
  ];

  // After the search, at the edge the panel opens from.
  const panelActions = useMemo<IToolbarAction[]>(
    () => [
      {
        id: "properties",
        label: t("modsTable::properties::toggle"),
        testId: "mod-properties-toggle",
        // Filled while the panel is open, as the toggle's on.
        icon: { name: "dock_to_left", filled: propertiesOpen },
        active: propertiesOpen,
        trackingProperties: { opened: !propertiesOpen },
        onClick: onToggleProperties,
      },
    ],
    [onToggleProperties, propertiesOpen, t],
  );

  useEffect(() => {
    if (optionsFor !== undefined && optionsFor === selectedView) {
      optionsPanelRef.current?.open();
      setOptionsFor(undefined);
    }
  }, [optionsFor, selectedView]);

  const editOptions = (viewId: string) => {
    onSelectView(viewId);
    setOptionsFor(viewId);
  };

  const pickerViews = views.map((view): IViewPickerView => {
    if (!view.isCustom) {
      return { id: view.id, label: t(view.label) };
    }

    return {
      id: view.id,
      label: view.label,
      // Rename and delete as Browse's views and the shared modals word them, from common.
      actions: [
        [
          {
            label: t("Rename view", { ns: "common" }),
            icon: "edit",
            onClick: () => setNaming(view),
          },
          {
            label: t("modsTable::toolbar::editViewOptions"),
            icon: "tune",
            onClick: () => editOptions(view.id),
          },
          {
            label: t("Delete view", { ns: "common" }),
            icon: "delete",
            onClick: () => setDeleting(view),
          },
        ],
      ],
    };
  });

  const statusChipLabel =
    filters.status.length === 1
      ? t(`modsTable::filters::${filters.status[0]}`)
      : t("modsTable::filters::statusCount", { count: filters.status.length });

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-y-2">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <ViewPicker
            className="min-w-0 flex-1"
            label={t("modsTable::toolbar::views")}
            selectedView={selectedView}
            views={pickerViews}
            onAddView={() => setNaming("picker")}
            onSelectView={onSelectView}
          />

          {filters.status.length > 0 && (
            <FilterChip
              icon="toggle_on"
              label={statusChipLabel}
              panel={({ close }) => statusMenu(close)}
              removeLabel={t("modsTable::filters::clearStatus")}
              testId="mods-table-status-chip"
              onRemove={() => onFiltersChange({ status: [] })}
            />
          )}

          <Toolbar className="shrink-0 justify-end" tracking={tracking}>
            <ToolbarGroup actions={actions} />

            <ToolbarSearch
              label={t("modsTable::toolbar::search")}
              testId="mods-table-search"
              value={search}
              onChange={onSearchChange}
            />

            <ToolbarGroup actions={panelActions} />
          </Toolbar>
        </div>

        {isEdited && !!open && (
          <div className="rounded-sm bg-surface-mid px-3 py-2">
            <EditedViewStrip
              resetHint={t("modsTable::editedView::resetHint")}
              saveHint={t("modsTable::editedView::saveHint")}
              viewLabel={t(open.label)}
              onReset={() => onResetFilters("edited_strip", undefined)}
              onSave={() => setNaming("edited_strip")}
            />
          </div>
        )}
      </div>

      <DeleteViewModal
        description={t("modsTable::deleteView::body", { name: deleting?.label })}
        name={deleting?.label}
        onClose={() => setDeleting(undefined)}
        onDelete={() => {
          if (deleting !== undefined) {
            onRemoveView(deleting.id);
          }
          setDeleting(undefined);
        }}
      />

      <ViewNameModal
        createDescription={t("modsTable::viewName::createIntro")}
        isOpen={naming !== undefined}
        placeholder={t("modsTable::viewName::placeholder")}
        renameDescription={t("modsTable::viewName::renameIntro")}
        renaming={typeof naming === "object" ? naming.label : undefined}
        onClose={() => setNaming(undefined)}
        onSubmit={(name) => {
          if (typeof naming === "object") {
            onRenameView(naming.id, name);
          } else if (naming !== undefined) {
            onAddView(name, naming);
          }
          setNaming(undefined);
        }}
      />
    </>
  );
};
