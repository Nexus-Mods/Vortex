import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { ToolbarSearch } from "@/ui/components/toolbar/toolbar_search/ToolbarSearch";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import type { IToolbarPanelHandle } from "@/ui/components/toolbar/ToolbarPanelButton";
import { useToolbarAnalytics } from "@/ui/components/toolbar/useToolbarAnalytics.hook";
import { type IViewPickerView, ViewPicker } from "@/ui/components/view_picker/ViewPicker";

import { MODS_TABLE_TOOLBARS } from "../../hooks/use_mods_table_analytics/useModsTableAnalytics.hook";
import type { IModsTableView } from "../../util/mods_table_views/modsTableViews";
import { DeleteModsTableViewModal } from "../delete_mods_table_view_modal/DeleteModsTableViewModal";
import { ModsTableViewNameModal } from "../mods_table_view_name_modal/ModsTableViewNameModal";

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
  /** Makes a view of the user's own, by name, and opens it. */
  onAddView: (name: string) => void;
  /** Renames a view of the user's own, by id. */
  onRenameView: (viewId: string, name: string) => void;
  /** Deletes a view of the user's own, by id. */
  onRemoveView: (viewId: string) => void;
  /** The view options' toolbar action, opening its panel. */
  displayOptions: IToolbarAction;
  /** The text the rows are filtered by. */
  search: string;
  /** Filters the rows by what's typed into the search. */
  onSearchChange: (search: string) => void;
}

/**
 * The new Mods table's views and actions, in its sticky head: its views in a
 * `ViewPicker`, the user's own with a menu to rename, edit or delete them. On the right,
 * the feedback form, the view options and the search.
 */
export const ModsTableToolbar = ({
  views,
  selectedView,
  onSelectView,
  onAddView,
  onRenameView,
  onRemoveView,
  displayOptions,
  search,
  onSearchChange,
}: IModsTableToolbarProps) => {
  const { t } = useTranslation(["common"]);
  // "new" while making a view, the view while renaming one, and unset otherwise.
  const [naming, setNaming] = useState<IModsTableView | "new">();
  const [deleting, setDeleting] = useState<IModsTableView>();
  const optionsPanel = useRef<IToolbarPanelHandle>(null);
  const tracking = useToolbarAnalytics(MODS_TABLE_TOOLBARS.head);
  const [optionsFor, setOptionsFor] = useState<string>();

  // Feedback first, then the view options, whose panel a view's menu can open.
  const actions = useMemo<IToolbarAction[]>(
    () => [
      {
        id: "feedback",
        label: t("Give feedback"),
        icon: "rate_review",
        onClick: () => window.api.shell.openUrl(MODS_TABLE_FEEDBACK_URL),
      },
      { ...displayOptions, id: "view-options", panelHandle: optionsPanel },
    ],
    [displayOptions, t],
  );

  useEffect(() => {
    if (optionsFor !== undefined && optionsFor === selectedView) {
      optionsPanel.current?.open();
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
      actions: [
        [
          { label: t("Rename view"), icon: "edit", onClick: () => setNaming(view) },
          {
            label: t("Edit view options"),
            icon: "tune",
            onClick: () => editOptions(view.id),
          },
          { label: t("Delete view"), icon: "delete", onClick: () => setDeleting(view) },
        ],
      ],
    };
  });

  return (
    <>
      <ViewPicker
        className="min-w-0 flex-1"
        label={t("Views")}
        selectedView={selectedView}
        views={pickerViews}
        onAddView={() => setNaming("new")}
        onSelectView={onSelectView}
      />

      <Toolbar className="shrink-0 justify-end" tracking={tracking}>
        <ToolbarGroup actions={actions} />

        <ToolbarSearch label={t("Search")} value={search} onChange={onSearchChange} />
      </Toolbar>

      <DeleteModsTableViewModal
        name={deleting?.label}
        onClose={() => setDeleting(undefined)}
        onDelete={() => {
          if (deleting !== undefined) {
            onRemoveView(deleting.id);
          }
          setDeleting(undefined);
        }}
      />

      <ModsTableViewNameModal
        isOpen={naming !== undefined}
        renaming={naming === "new" ? undefined : naming?.label}
        onClose={() => setNaming(undefined)}
        onSubmit={(name) => {
          if (naming === "new") {
            onAddView(name);
          } else if (naming !== undefined) {
            onRenameView(naming.id, name);
          }
          setNaming(undefined);
        }}
      />
    </>
  );
};
