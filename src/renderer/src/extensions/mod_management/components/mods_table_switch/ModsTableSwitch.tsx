import React, { type ReactNode, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { ITableRowAction } from "@/controls/Table";
import type { IState } from "@/types/IState";
import { useDisplayOptionsAction } from "@/ui/components/display_options/useDisplayOptionsAction.hook";
import { DropdownBlock } from "@/ui/components/dropdown/DropdownBlock";
import { DropdownDivider } from "@/ui/components/dropdown/DropdownDivider";
import { Switch } from "@/ui/components/form/switch/Switch";
import { Image } from "@/ui/components/image/Image";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { Table } from "@/ui/components/table/Table";
import type { ITableSort } from "@/ui/components/table/Table.types";
import { TableSelectionBar } from "@/ui/components/table/table_selection_bar/TableSelectionBar";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarMenu } from "@/ui/components/toolbar/ToolbarMenu";
import { useToolbarAnalytics } from "@/ui/components/toolbar/useToolbarAnalytics.hook";
import { Typography } from "@/ui/components/typography/Typography";

import { useCollectionGroupActions } from "../../hooks/use_collection_group_actions/useCollectionGroupActions.hook";
import { useGroupEnabled } from "../../hooks/use_group_enabled/useGroupEnabled.hook";
import { useInstallMods } from "../../hooks/use_install_mods/useInstallMods.hook";
import {
  MOD_ROW_PINNING_ID,
  MOD_SELECTION_PINNING_ID,
  useModRowActions,
  useModSelectionActions,
} from "../../hooks/use_mod_actions/useModActions.hook";
import { useModsEnabled } from "../../hooks/use_mods_enabled/useModsEnabled.hook";
import {
  MODS_TABLE_TOOLBARS,
  modsTableGroupToolbar,
  useModsTableAnalytics,
} from "../../hooks/use_mods_table_analytics/useModsTableAnalytics.hook";
import {
  type IModsTableColumn,
  useModsTableColumns,
} from "../../hooks/use_mods_table_columns/useModsTableColumns.hook";
import { useModsTableDataColumns } from "../../hooks/use_mods_table_data_columns/useModsTableDataColumns.hook";
import { useModsTableFocusRequest } from "../../hooks/use_mods_table_focus_request/useModsTableFocusRequest.hook";
import {
  useCollectionMemberships,
  useModsTableGroups,
} from "../../hooks/use_mods_table_groups/useModsTableGroups.hook";
import { useModsTableSearch } from "../../hooks/use_mods_table_search/useModsTableSearch.hook";
import { useModsTableView } from "../../hooks/use_mods_table_view/useModsTableView.hook";
import type { IModWithState } from "../../types/IModProps";
import {
  allModRows,
  type IModGroup,
  type IModRow,
} from "../../util/mods_table_views/modsTableViews";
import { CollectionHoverCard } from "../collection_hover_card/CollectionHoverCard";
import { CollectionRevision } from "../collection_revision/CollectionRevision";
import { DisableSharedModsModal } from "../disable_shared_mods_modal/DisableSharedModsModal";
import { ModHoverCard } from "../mod_hover_card/ModHoverCard";
import { actionsWidth, ModRowActions, PINNED_ACTION_WIDTH } from "../mod_row_actions/ModRowActions";
import {
  MOD_VERSION_GROUPS,
  ModVersion,
  modVersionGroup,
  modVersionGroupName,
  modVersionText,
} from "../mod_version/ModVersion";
import { ModsTableColumnToggles } from "../mods_table_column_toggles/ModsTableColumnToggles";
import { ModsTableGroupBy } from "../mods_table_group_by/ModsTableGroupBy";
import { ModsTableToolbar } from "../mods_table_toolbar/ModsTableToolbar";

interface IModsTableSwitchProps {
  /** The mods, collections among them: the collections head their groups, never rows. */
  mods: { [id: string]: IModWithState };
  /** The table shown unless the user has switched to the beta view. */
  legacy: ReactNode;
  /** Enables or disables mods, installing any that are only downloaded first; settles once done. */
  onSetModsEnabled: (modIds: string[], enabled: boolean) => void | PromiseLike<unknown>;
  /** The legacy table's row actions, offered in each row's menu with the extensions' own. */
  rowActions?: ITableRowAction[];
  /** Each listed mod's installed versions and variants, itself included, by its id. */
  alternatives?: { [modId: string]: IModWithState[] };
  /** Switches from a mod to another of its versions or variants, by id. */
  onSelectVersion?: (modId: string, alternativeId: string) => void;
  /** Removes one of a mod's versions or variants, by id, asking first. */
  onRemoveVersion?: (alternativeId: string) => void;
}

const BY_NAME: ITableSort = { columnId: "name", direction: "ascending" };

const betaTable = (state: IState) => state.settings.mods?.betaTable === true;

/** The groups the Status column puts rows in, in order; ids, not names. */
const STATUS_GROUPS = [
  "never-installed",
  "uninstalled",
  "installing",
  "enabled",
  "disabled",
] as const;

type StatusGroup = (typeof STATUS_GROUPS)[number];

/** Each group's name, by its key; one per group, so a group added without one won't build. */
const STATUS_GROUP_NAMES: Record<StatusGroup, string> = {
  "never-installed": "modsTable::groups::neverInstalled",
  uninstalled: "modsTable::groups::uninstalled",
  installing: "modsTable::groups::installing",
  enabled: "modsTable::groups::enabled",
  disabled: "modsTable::groups::disabled",
};

const isStatusGroup = (value: string): value is StatusGroup =>
  (STATUS_GROUPS as readonly string[]).includes(value);

const NO_ROW_ACTIONS: ITableRowAction[] = [];
const NO_ALTERNATIVES: { [modId: string]: IModWithState[] } = {};
const NO_MODS: { [id: string]: IModWithState } = {};
const nop = () => undefined;

/**
 * The Mods page's table: the classic one, or the new one while the user has the beta view on.
 *
 * The new table is asked to show a group or a mod; see useModsTableFocusRequest.
 */
export const ModsTableSwitch = ({
  mods,
  legacy,
  onSetModsEnabled,
  rowActions = NO_ROW_ACTIONS,
  alternatives = NO_ALTERNATIVES,
  onSelectVersion = nop,
  onRemoveVersion,
}: IModsTableSwitchProps) => {
  const { t } = useTranslation("mod_management");
  const newTable = useSelector(betaTable);

  const {
    views,
    view,
    grouping,
    groupingLocked,
    isColumnShown,
    columnWidths,
    canReset,
    select: selectView,
    setGrouping,
    setColumnVisible,
    setColumnWidths,
    reset: resetView,
    addView,
    renameView,
    removeView,
  } = useModsTableView(mods);
  // The legacy table builds its own rows and groups, so build none for it.
  const tableMods = newTable ? mods : NO_MODS;
  const rows = useMemo(() => allModRows(tableMods), [tableMods]);
  const memberships = useCollectionMemberships(mods);
  const { changing, setEnabled, isEnabled } = useModsEnabled(onSetModsEnabled);

  const enableInstalled = useCallback((ids: string[]) => setEnabled(ids, true), [setEnabled]);
  const installMods = useInstallMods(enableInstalled);
  const install = useCallback((modId: string) => void installMods([modId]), [installMods]);

  const {
    setGroupEnabled,
    pending: pendingDisable,
    disablePending,
    cancelPending,
  } = useGroupEnabled(memberships, setEnabled);

  const dataColumns = useModsTableDataColumns(memberships);

  const { actionsFor, pinnedCount } = useModRowActions(rowActions);
  const analytics = useModsTableAnalytics();
  const rowTracking = useToolbarAnalytics(MODS_TABLE_TOOLBARS.row);
  const selectionTracking = useToolbarAnalytics(MODS_TABLE_TOOLBARS.selection);
  const groupTracking = useToolbarAnalytics(modsTableGroupToolbar(grouping));

  const collectionActions = useCollectionGroupActions(actionsFor);

  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  // Those still listed, as a removed mod can't be acted on.
  const selectedIds = useMemo(
    () => [...selected].filter((id) => mods[id] !== undefined),
    [mods, selected],
  );
  const selectionActions = useModSelectionActions(rowActions, selectedIds);
  const selectedEnabled = selectedIds.filter((id) => isEnabled(mods[id])).length;

  // A row's actions are for its own mod, which would read as for every selected one.
  const multiSelected = selectedIds.length > 1;
  const shownPins = multiSelected ? 0 : pinnedCount;

  // Apart from the columns, which a toggle rebuilds, as only the language changes these.
  const groupNames = useMemo(
    () => ({
      status: (value: string) => (isStatusGroup(value) ? t(STATUS_GROUP_NAMES[value]) : value),
      version: (value: string) => modVersionGroupName(value, t),
    }),
    [t],
  );

  const columns = useMemo<IModsTableColumn[]>(
    () => [
      {
        id: "name",
        header: t("modsTable::columns::name"),
        sort: (a, b) => a.name.localeCompare(b.name),
        searchText: ({ name }) => name,
        cell: ({ mod, name }) => (
          <>
            <ModHoverCard className="ml-2 h-5 rounded-sm" mod={mod} name={name} />

            <span className="ml-2 truncate">{name}</span>
          </>
        ),
        groupCell: ({ avatar, collection, label, rows }) => (
          <>
            {!!avatar && (
              <Image
                alt=""
                className="ml-3.5 h-6 rounded-full"
                fallbackIcon={{ name: "person", filled: true }}
                fit="cover"
                imageType="avatar"
                src={avatar.src}
              />
            )}

            {!!collection && (
              <CollectionHoverCard className="ml-3 h-8 rounded-xs" collection={collection} />
            )}

            <span className="ml-2 truncate">{label}</span>

            <span className="ml-2 font-normal text-translucent-moderate">{rows.length}</span>
          </>
        ),
      },
      {
        id: "status",
        header: t("modsTable::columns::actions"),
        groupLabel: t("modsTable::columns::status"),
        width: actionsWidth(0),
        resizable: false,
        revealWidth: shownPins ? `${PINNED_ACTION_WIDTH * shownPins}px` : undefined,
        sticky: "end",
        groupBy: ({ mod }) => {
          if (mod.state === "downloaded") {
            return mod.attributes?.wasInstalled ? "uninstalled" : "never-installed";
          }
          if (mod.state === "installing") {
            return "installing";
          }
          return isEnabled(mod) ? "enabled" : "disabled";
        },
        groupOrder: STATUS_GROUPS,
        groupValueLabel: groupNames.status,
        cell: ({ mod, name }) => (
          <ModRowActions
            actions={actionsFor(mod.id)}
            enabled={isEnabled(mod)}
            installLabel={t("modsTable::rowActions::installMod", { name })}
            isLoading={changing.has(mod.id)}
            label={t("modsTable::rowActions::enabled", { name })}
            modId={mod.id}
            modState={mod.state}
            switchOnly={multiSelected}
            width={actionsWidth(shownPins)}
            onInstall={mod.state === "downloaded" ? install : undefined}
            onSetEnabled={setEnabled}
          />
        ),
        /**
         * Part on while only some of its mods are, as after keeping the shared ones; right-aligned
         * before the "…" the table puts at the cell's end, so it lines up with its rows' switches.
         */
        groupCell: (group) => {
          const enabled = group.rows.filter(({ mod }) => isEnabled(mod)).length;

          return (
            <div className="flex min-w-0 flex-1 items-center justify-end">
              <Switch
                aria-label={t("modsTable::rowActions::enabled", { name: group.label })}
                checked={group.rows.length > 0 && enabled === group.rows.length}
                indeterminate={enabled > 0 && enabled < group.rows.length}
                isLoading={group.rows.some(({ mod }) => changing.has(mod.id))}
                onChange={(checked) => setGroupEnabled(group, checked)}
              />
            </div>
          );
        },
      },
      // The legacy table's, sharing its choice to show it and its place.
      {
        id: "version",
        header: t("modsTable::columns::version"),
        width: "160px",
        isToggleable: true,
        position: 40,
        searchText: ({ mod }) => modVersionText(mod, alternatives[mod.id], t),
        groupBy: ({ mod }) => modVersionGroup(mod),
        groupOrder: MOD_VERSION_GROUPS,
        groupValueLabel: groupNames.version,
        cell: ({ mod }) => (
          <ModVersion
            alternatives={alternatives[mod.id]}
            mod={mod}
            onRemove={onRemoveVersion}
            onSelect={onSelectVersion}
          />
        ),
        // A collection's group shows its revision, as the collection's own row does.
        groupCell: ({ collection }) =>
          collection === undefined ? null : <CollectionRevision collection={collection} />,
      },
      ...dataColumns,
    ],
    [
      actionsFor,
      alternatives,
      changing,
      dataColumns,
      groupNames,
      install,
      isEnabled,
      multiSelected,
      onRemoveVersion,
      onSelectVersion,
      setEnabled,
      setGroupEnabled,
      shownPins,
      t,
    ],
  );

  const { visibleColumns, toggles, groupable } = useModsTableColumns(columns, isColumnShown);

  const groups = useModsTableGroups(tableMods, grouping, groupable, memberships, t);

  const { search, setSearch, changeSearch, isSearching, shownRows, shownGroups } =
    useModsTableSearch({
      rows,
      groups,
      visibleColumns,
      selected,
      setSelected,
      onSearchStarted: analytics.onSearchStarted,
    });

  const { focusGroupId, onGroupFocused, focusModId, onModFocused } = useModsTableFocusRequest({
    groups,
    rows,
    search,
    setSearch,
  });

  const displayOptions = useDisplayOptionsAction({
    label: t("modsTable::toolbar::viewOptions"),
    canReset,
    children: (
      <>
        <ModsTableGroupBy
          columns={groupable}
          disabled={groupingLocked}
          grouping={grouping}
          onChange={setGrouping}
        />

        <ModsTableColumnToggles toggles={toggles} onToggle={setColumnVisible} />
      </>
    ),
    onReset: resetView,
  });

  if (!newTable) {
    return <>{legacy}</>;
  }

  const footer = multiSelected && (
    <TableSelectionBar count={selectedIds.length} onClear={() => setSelected(new Set())}>
      <Toolbar
        className="min-w-0 flex-1 justify-end"
        pinningId={MOD_SELECTION_PINNING_ID}
        tracking={selectionTracking}
      >
        {/* Always on the bar, ahead of the menu: the one action that can't be unpinned. */}
        <ToolbarGroup
          actions={selectionActions}
          beforeOverflow={
            <Switch
              aria-label={t("modsTable::selection::enabled")}
              checked={selectedEnabled === selectedIds.length}
              indeterminate={selectedEnabled > 0 && selectedEnabled < selectedIds.length}
              isLoading={selectedIds.some((id) => changing.has(id))}
              onChange={(checked) => setEnabled(selectedIds, checked)}
            />
          }
        />
      </Toolbar>
    </TableSelectionBar>
  );

  const tableProps = {
    focusGroupId,
    onGroupFocused,
    focusRowId: focusModId,
    onRowFocused: onModFocused,
    className: "mb-2 flex-1",
    toolbar: (
      <ModsTableToolbar
        displayOptions={displayOptions}
        search={search}
        selectedView={view.id}
        views={views}
        onAddView={addView}
        onRemoveView={removeView}
        onRenameView={renameView}
        onSearchChange={changeSearch}
        onSelectView={selectView}
      />
    ),
    columns: visibleColumns,
    columnWidths,
    onColumnWidthsChange: setColumnWidths,
    getRowId: ({ mod }: IModRow) => mod.id,
    label: t("modsTable::label"),
    selectable: true,
    getRowLabel: ({ name }: IModRow) => name,
    selectedIds: selected,
    onSelectedIdsChange: setSelected,
    rowMenu: ({ mod, name }: IModRow, close: () => void) =>
      multiSelected ? (
        <>
          <DropdownBlock>
            <Typography appearance="subdued" typographyType="body-sm">
              {t("modsTable::selection::count", { count: selectedIds.length })}
            </Typography>
          </DropdownBlock>

          <DropdownDivider />

          <ToolbarMenu
            actions={selectionActions}
            label={t("modsTable::selection::actions")}
            tracking={selectionTracking}
            onSelect={close}
          />
        </>
      ) : (
        <ToolbarMenu
          actions={actionsFor(mod.id)}
          label={t("modsTable::rowActions::menu", { name })}
          pinningId={MOD_ROW_PINNING_ID}
          pinTarget="row"
          tracking={rowTracking}
          onSelect={close}
        />
      ),
    groupMenu: ({ collection }: IModGroup) => {
      if (!collection) {
        return [];
      }
      return collectionActions(collection);
    },
    groupTracking,
    onMenuOpen: analytics.onMenuOpen,
    defaultSort: BY_NAME,
    footer,
    empty: isSearching && <NoResults icon="search" title={t("modsTable::noResults")} />,
  };

  // A table takes rows or groups, never both; typed, so neither gains the other as undefined.
  const data: { groups: IModGroup[] } | { rows: IModRow[] } = shownGroups
    ? { groups: shownGroups }
    : { rows: shownRows };

  return (
    <>
      <Table {...tableProps} {...data} />

      <DisableSharedModsModal
        collections={pendingDisable?.shared.collections ?? []}
        isOpen={pendingDisable !== undefined}
        sharedCount={pendingDisable?.shared.rows.length ?? 0}
        onClose={cancelPending}
        onDisableAll={() => disablePending(false)}
        onKeepShared={() => disablePending(true)}
      />
    </>
  );
};
