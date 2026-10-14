import { PopoverButton as HeadlessPopoverButton } from "@headlessui/react";
import {
  mdiDeleteOutline,
  mdiDotsHorizontal,
  mdiMessageStarOutline,
  mdiPencil,
  mdiPlus,
  mdiTune,
} from "@mdi/js";
import React, { Fragment, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import {
  ContextMenu,
  contextMenuPosition,
  type IContextMenuPosition,
} from "@/ui/components/context_menu/ContextMenu";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import type { IMenuAction } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { ToolbarSearch } from "@/ui/components/toolbar/toolbar_search/ToolbarSearch";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import type { IToolbarPanelHandle } from "@/ui/components/toolbar/ToolbarPanelButton";
import { useToolbarAnalytics } from "@/ui/components/toolbar/useToolbarAnalytics.hook";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";

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

interface ICustomViewButtonProps {
  view: IModsTableView;
  selected: boolean;
  onSelect: () => void;
  onRename: () => void;
  onEditOptions: () => void;
  onRemove: () => void;
}

/**
 * A view of the user's own: its button, with a menu of what can be done with it on a "…"
 * nested inside, as a menu row's pin is, which opens the menu without opening the view. A
 * right-click on the button, or Shift+F10, opens the same menu where it's asked for.
 */
const CustomViewButton = ({
  view,
  selected,
  onSelect,
  onRename,
  onEditOptions,
  onRemove,
}: ICustomViewButtonProps) => {
  const { t } = useTranslation(["common"]);
  const [contextMenu, setContextMenu] = useState<IContextMenuPosition>();

  const label = t("{{name}} view actions", { name: view.label });
  const actions: IMenuAction[][] = [
    [
      { label: t("Rename view"), iconPath: mdiPencil, onClick: onRename },
      { label: t("Edit view options"), iconPath: mdiTune, onClick: onEditOptions },
      { label: t("Delete view"), iconPath: mdiDeleteOutline, onClick: onRemove },
    ],
  ];

  return (
    <Popover className="flex">
      <button
        aria-label={view.label}
        aria-pressed={selected}
        className="nxm-table-view-button nxm-table-view-button-menu"
        type="button"
        onClick={onSelect}
        onContextMenu={(event) => {
          event.preventDefault();
          setContextMenu(contextMenuPosition(event));
        }}
      >
        <span>{view.label}</span>

        <HeadlessPopoverButton
          nested
          appearance="weak"
          aria-haspopup="menu"
          aria-label={label}
          as={Button}
          brand="neutral"
          leftIconPath={mdiDotsHorizontal}
          size="sm"
          onClick={(event: MouseEvent) => event.stopPropagation()}
        />
      </button>

      <PopoverPanel anchor={{ gap: 4, to: "bottom start" }} className="nxm-popover-panel-dropdown">
        {({ close }) => <PopoverMenu actions={actions} label={label} onSelect={close} />}
      </PopoverPanel>

      <ContextMenu position={contextMenu} onClose={() => setContextMenu(undefined)}>
        {(close) => <PopoverMenu actions={actions} label={label} onSelect={close} />}
      </ContextMenu>
    </Popover>
  );
};

/**
 * The new Mods table's views and actions, in its sticky head. Views aren't tabs, with no
 * panels of their own, so they're toggle buttons. The built-in views come first, the user's
 * own after a divider, each with a menu, then the button to make another. On the right, the
 * feedback form, the view options and the search.
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
        iconPath: mdiMessageStarOutline,
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

  return (
    <>
      <div
        aria-label={t("Views")}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-1"
        role="group"
      >
        {views.map((view, index) => {
          const selected = view.id === selectedView;
          const firstCustom = view.isCustom && !views[index - 1]?.isCustom;

          return (
            <Fragment key={view.id}>
              {firstCustom && (
                <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-stroke-weak" />
              )}

              {view.isCustom ? (
                <CustomViewButton
                  selected={selected}
                  view={view}
                  onEditOptions={() => editOptions(view.id)}
                  onRemove={() => setDeleting(view)}
                  onRename={() => setNaming(view)}
                  onSelect={() => onSelectView(view.id)}
                />
              ) : (
                <button
                  aria-pressed={selected}
                  className="nxm-table-view-button"
                  type="button"
                  onClick={() => onSelectView(view.id)}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  {t(view.label)}
                </button>
              )}
            </Fragment>
          );
        })}

        <Tooltip content={t("Add view")}>
          <Button
            appearance="weak"
            aria-label={t("Add view")}
            brand="neutral"
            leftIconPath={mdiPlus}
            onClick={() => setNaming("new")}
          />
        </Tooltip>
      </div>

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
