import { mdiAccount, mdiMagnify, mdiPlus } from "@mdi/js";
import React, {
  memo,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { createSelector } from "reselect";

import type { ITableRowAction } from "@/controls/Table";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { useDisplayOptionsAction } from "@/ui/components/display_options/useDisplayOptionsAction.hook";
import { DropdownBlock } from "@/ui/components/dropdown/DropdownBlock";
import { DropdownDivider } from "@/ui/components/dropdown/DropdownDivider";
import { Switch } from "@/ui/components/form/switch/Switch";
import { Image } from "@/ui/components/image/Image";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { Table } from "@/ui/components/table/Table";
import type { ITableSort, TableColumnWidth } from "@/ui/components/table/Table.types";
import { TableSelectionBar } from "@/ui/components/table/table_selection_bar/TableSelectionBar";
import { useTableRowEngaged } from "@/ui/components/table/TableRow.context";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { type IToolbarAction, ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarMenu } from "@/ui/components/toolbar/ToolbarMenu";
import { useToolbarAnalytics } from "@/ui/components/toolbar/useToolbarAnalytics.hook";
import { TitledTooltip } from "@/ui/components/tooltip/TitledTooltip";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { activeGameId } from "@/util/selectors";

import { collectionsByMod } from "../../../collections/util/collectionsByMod";
import { makeCollectionModsResolver } from "../../../collections/util/resolveCollectionMods/resolveCollectionMods";
import { activeProfile } from "../../../profile_management/selectors";
import { useCollectionGroupActions } from "../../hooks/use_collection_group_actions/useCollectionGroupActions.hook";
import {
  INSTALLING_ACTIVITY,
  useInstallMods,
} from "../../hooks/use_install_mods/useInstallMods.hook";
import {
  MOD_ROW_PINNING_ID,
  MOD_SELECTION_PINNING_ID,
  useModRowActions,
  useModSelectionActions,
} from "../../hooks/use_mod_actions/useModActions.hook";
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
import { useModsTableView } from "../../hooks/use_mods_table_view/useModsTableView.hook";
import { UNINSTALLING_ACTIVITY } from "../../hooks/use_uninstall_mods/useUninstallMods.hook";
import type { IModWithState } from "../../types/IModProps";
import {
  allModRows,
  groupMods,
  type IModGroup,
  type IModRow,
  type ISharedMods,
  sharedMods,
} from "../../util/mods_table_views/modsTableViews";
import { CollectionHoverCard } from "../collection_hover_card/CollectionHoverCard";
import { CollectionRevision } from "../collection_revision/CollectionRevision";
import { DisableSharedModsModal } from "../disable_shared_mods_modal/DisableSharedModsModal";
import { ModHoverCard } from "../mod_hover_card/ModHoverCard";
import { ModVersion, modVersionGroup, modVersionText } from "../mod_version/ModVersion";
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

/** A group being disabled, while the user decides about the mods it shares. */
interface IPendingDisable {
  group: IModGroup;
  shared: ISharedMods;
}

const BY_NAME: ITableSort = { columnId: "name", direction: "ascending" };

const modIds = (rows: IModRow[]) => rows.map(({ mod }) => mod.id);

/** A group's mods, and its collection's own, which no row switches. */
const groupModIds = ({ collection, rows }: IModGroup) =>
  collection ? [collection.id, ...modIds(rows)] : modIds(rows);

const profileModState = (state: IState) => activeProfile(state)?.modState;

const betaTable = (state: IState) => state.settings.mods?.betaTable === true;

/** The group the table is asked to show. */
const storedMods = (state: IState) => state.persistent.mods?.[activeGameId(state)];

/** The archives the stored mods come from, worked out once each time the mods change. */
const storedArchiveIds = createSelector(
  storedMods,
  (stored) => new Set(Object.values(stored ?? {}).map((mod) => mod.archiveId)),
);

/**
 * What a row's mod is under way with, if anything, as a plain value, so a row re-renders
 * only when its own answer changes, not on every write to the store.
 *
 * The list catches up with the store after a debounce, so a row can outlive what it shows:
 * an archive a mod in the store now comes from has just been installed, and a mod gone from
 * the store has just been uninstalled. Either stays loading until its new row takes over.
 */
const useRowBusy = (modId: string, modState: IModWithState["state"]): RowBusy | undefined =>
  useSelector((state: IState) => {
    const activity = state.session?.base?.activity;
    const justInstalled = modState === "downloaded" && storedArchiveIds(state).has(modId);
    if (
      modState === "installing" ||
      activity?.[INSTALLING_ACTIVITY]?.includes(modId) ||
      justInstalled
    ) {
      return "installing";
    }

    const stored = storedMods(state);
    const removed = modState === "installed" && stored !== undefined && !stored[modId];
    if (activity?.[UNINSTALLING_ACTIVITY]?.includes(modId) || removed) {
      return "uninstalling";
    }

    return undefined;
  });

/**
 * Whether a row shows the text searched for, ignoring case, in any of the columns' cells;
 * undefined while there's nothing to search for.
 */
const searchFilter = (columns: IModsTableColumn[], search: string) => {
  const query = search.trim().toLocaleLowerCase();

  if (query === "") {
    return undefined;
  }

  return (row: IModRow) =>
    columns.some((column) => column.searchText?.(row).toLocaleLowerCase().includes(query));
};

const NO_ROW_ACTIONS: ITableRowAction[] = [];
const NO_ALTERNATIVES: { [modId: string]: IModWithState[] } = {};
const nop = () => undefined;

// The switch and the menu's button; each pinned action adds a 28px button and an 8px gap.
const ACTIONS_WIDTH = 78;
const PINNED_ACTION_WIDTH = 36;

const actionsWidth = (pinnedCount: number): TableColumnWidth =>
  `${ACTIONS_WIDTH + PINNED_ACTION_WIDTH * pinnedCount}px`;

interface IModRowActionsProps {
  /** The row's actions, the same array until they change. */
  actions: IToolbarAction[];
  /** Room for the pins, the switch and the menu, wider than the column is at rest. */
  width: TableColumnWidth;
  /** The mod the row is for, which the switch enables or disables. */
  modId: string;
  /** The switch's name. */
  label: string;
  /** Whether the switch is on, showing a change at once while it lands. */
  enabled: boolean;
  /** Whether a change is under way, which busies the switch. */
  isLoading: boolean;
  /** Enables or disables the mods, from the switch. */
  onSetEnabled: (modIds: string[], enabled: boolean) => void;
  /** Shows the switch alone while several rows are selected, so no action reads as for them all. */
  switchOnly: boolean;
  /** Installs the mod, for one only downloaded, whose button stands in for the switch. */
  onInstall?: (modId: string) => void;
  /** The mod's state, from which the row works out what's under way, as its own selector. */
  modState: IModWithState["state"];
  /** The install button's name, while there is one. */
  installLabel?: string;
}

/** A mod being installed or uninstalled, which its row shows on the install button. */
type RowBusy = "installing" | "uninstalling";

/** Marks the switch, or the install button in its place, for focus to return to. */
const ROW_CONTROL = "data-row-control";

/**
 * A row's pinned actions, its switch, then its menu of every action. Against the cell's end,
 * as a group row's switch is, and as wide as the pins need so none collapse: at rest they
 * overhang the column, hidden, and the cell widens over them while the row is hovered.
 *
 * Only the switch renders until the row is first pointed at or focused, in the place the
 * toolbar puts it: the pins and the menu are hidden at rest, and a toolbar per row is costly
 * to mount as rows scroll in. Then the toolbar mounts and stays while the row does, so a menu
 * opened from it isn't torn down. Memoized, since rows re-render on each frame of a scroll.
 *
 * While several rows are selected, only the switch shows, in the same place, as at rest.
 *
 * A mod that's only downloaded has an Install button in the switch's place; one being installed
 * or uninstalled has it loading.
 */
const ModRowActions = memo(
  ({
    actions,
    width,
    modId,
    label,
    enabled,
    isLoading,
    onSetEnabled,
    switchOnly,
    onInstall,
    installLabel,
    modState,
  }: IModRowActionsProps) => {
    const { t } = useTranslation(["common"]);
    const tracking = useToolbarAnalytics(MODS_TABLE_TOOLBARS.row);
    const busy = useRowBusy(modId, modState);
    const engaged = useTableRowEngaged();
    const restingRef = useRef<HTMLDivElement>(null);
    // the cell, while the resting switch has focus as the toolbar replaces it
    const refocusIn = useRef<HTMLElement | null>(null);

    useLayoutEffect(() => {
      if (engaged && refocusIn.current !== null) {
        refocusIn.current.querySelector<HTMLElement>(`[${ROW_CONTROL}]`)?.focus();
        refocusIn.current = null;
      }
    }, [engaged]);

    const installDescription = t(
      "Installs the mod into your game, where it can be enabled or disabled.",
    );

    const toggle =
      onInstall === undefined && busy === undefined ? (
        <Switch
          {...{ [ROW_CONTROL]: true }}
          aria-label={label}
          checked={enabled}
          isLoading={isLoading}
          onChange={(checked) => onSetEnabled([modId], checked)}
        />
      ) : (
        // On a wrapper, as a loading button is disabled and takes no hover. As wide as the switch
        // it stands in for, from its start, so it lines up with theirs.
        <Tooltip
          {...(busy === undefined
            ? { customContent: <TitledTooltip body={installDescription} title={t("Install")} /> }
            : { content: busy === "installing" ? t("Installing…") : t("Uninstalling…") })}
        >
          <span className="flex w-8 shrink-0">
            <Button
              {...{ [ROW_CONTROL]: true }}
              // a step lighter while loading, so it drops its border
              appearance={busy === undefined ? "subdued" : "weak"}
              aria-description={busy === undefined ? installDescription : undefined}
              aria-label={installLabel}
              brand="primary"
              isLoading={isLoading || busy !== undefined}
              leftIconPath={mdiPlus}
              size="sm"
              onClick={() => onInstall?.(modId)}
            />
          </span>
        </Tooltip>
      );

    if (!engaged || switchOnly) {
      return (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end gap-x-2"
          ref={restingRef}
          style={{ width }}
          onFocus={() => {
            if (!engaged) {
              refocusIn.current = restingRef.current?.parentElement ?? null;
            }
          }}
        >
          {toggle}

          <span aria-hidden className="w-7 shrink-0" />
        </div>
      );
    }

    return (
      <Toolbar
        className="absolute inset-y-0 right-0 justify-end"
        pinningId={MOD_ROW_PINNING_ID}
        pinTarget="row"
        style={{ width }}
        tracking={tracking}
      >
        <ToolbarGroup actions={actions} beforeOverflow={toggle} />
      </Toolbar>
    );
  },
);

/**
 * The Mods page's table: the classic one, or the new one while the user has the beta view on.
 *
 * The new table is asked to show a group; see useModsTableFocusRequest.
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
  const { t } = useTranslation(["common"]);
  const newTable = useSelector(betaTable);

  const {
    views,
    view,
    grouping,
    groupingLocked,
    isColumnShown,
    canReset,
    select: selectView,
    setGrouping,
    setColumnVisible,
    reset: resetView,
    addView,
    renameView,
    removeView,
  } = useModsTableView(mods);
  const rows = useMemo(() => allModRows(mods), [mods]);
  const [search, setSearch] = useState("");
  // Kept, so a change to the mods only retests those that changed against each collection.
  const [resolveMembers] = useState(makeCollectionModsResolver);
  const memberships = useMemo(() => collectionsByMod(mods, resolveMembers), [mods, resolveMembers]);
  const [pendingDisable, setPendingDisable] = useState<IPendingDisable>();

  // Extensions get a say before a mod's state changes, which can take a while, so the
  // switch shows the change at once, busy, until it lands or fails.
  const [changing, setChanging] = useState<ReadonlyMap<string, boolean>>(() => new Map());

  const setEnabled = useCallback(
    (ids: string[], enabled: boolean) => {
      if (ids.length === 0) {
        return;
      }

      setChanging((previous) => new Map([...previous, ...ids.map((id) => [id, enabled] as const)]));

      const settle = () =>
        setChanging((previous) => {
          const next = new Map(previous);
          ids.filter((id) => next.get(id) === enabled).forEach((id) => next.delete(id));
          return next;
        });

      Promise.resolve(onSetModsEnabled(ids, enabled)).then(settle, settle);
    },
    [onSetModsEnabled],
  );

  const enableInstalled = useCallback((ids: string[]) => setEnabled(ids, true), [setEnabled]);
  const installMods = useInstallMods(enableInstalled);
  const install = useCallback((modId: string) => void installMods([modId]), [installMods]);

  // Turning a group off asks first when other collections share some of its mods.
  const setGroupEnabled = useCallback(
    (group: IModGroup, enabled: boolean) => {
      const shared = sharedMods(group, memberships);

      if (enabled || shared.rows.length === 0) {
        setEnabled(groupModIds(group), enabled);
        return;
      }

      setPendingDisable({ group, shared });
    },
    [memberships, setEnabled],
  );

  const disablePending = (keepShared: boolean) => {
    if (pendingDisable === undefined) {
      return;
    }

    const keep = new Set(keepShared ? modIds(pendingDisable.shared.rows) : []);
    setEnabled(
      groupModIds(pendingDisable.group).filter((id) => !keep.has(id)),
      false,
    );
    setPendingDisable(undefined);
  };

  const dataColumns = useModsTableDataColumns(memberships);

  // From the profile, which a switch changes at once; the mods catch up only once ModList,
  // after its debounce, rebuilds them.
  const modState = useSelector(profileModState);
  const isEnabled = useCallback(
    (mod: IModWithState) => changing.get(mod.id) ?? modState?.[mod.id]?.enabled ?? !!mod.enabled,
    [changing, modState],
  );

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

  const columns = useMemo<IModsTableColumn[]>(
    () => [
      {
        id: "name",
        header: t("Name"),
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
                fallbackIconPath={mdiAccount}
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
        header: t("Actions"),
        groupLabel: t("Status"),
        width: actionsWidth(0),
        revealWidth: shownPins ? `${PINNED_ACTION_WIDTH * shownPins}px` : undefined,
        sticky: "end",
        groupBy: ({ mod }) => {
          if (mod.state === "downloaded") {
            return mod.attributes?.wasInstalled ? t("Uninstalled") : t("Never installed");
          }
          if (mod.state === "installing") {
            return t("Installing");
          }
          return isEnabled(mod) ? t("Enabled") : t("Disabled");
        },
        groupOrder: [
          t("Never installed"),
          t("Uninstalled"),
          t("Installing"),
          t("Enabled"),
          t("Disabled"),
        ],
        cell: ({ mod, name }) => (
          <ModRowActions
            actions={actionsFor(mod.id)}
            enabled={isEnabled(mod)}
            installLabel={t("Install {{name}}", { name })}
            isLoading={changing.has(mod.id)}
            label={t("{{name}} enabled", { name })}
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
                aria-label={t("{{name}} enabled", { name: group.label })}
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
        header: t("Version"),
        width: "160px",
        isToggleable: true,
        position: 40,
        searchText: ({ mod }) => modVersionText(mod, alternatives[mod.id], t),
        groupBy: ({ mod }) => modVersionGroup(mod, t),
        groupOrder: [t("Update available"), t("Up-to-date")],
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

  // Regroups when the grouped-by column changes, not whenever any column does, as Status does on each switch.
  const groupColumn = groupable.find((column) => column.id === grouping);
  const groups = useMemo(
    () => groupMods(mods, grouping, t, memberships, groupColumn),
    [mods, grouping, t, memberships, groupColumn],
  );

  const { focusGroupId, onGroupFocused } = useModsTableFocusRequest({ groups, search, setSearch });

  // The columns shown, so a search finds only what's on screen.
  const searchColumns = useMemo(
    () => visibleColumns.filter((column) => column.searchText !== undefined),
    [visibleColumns],
  );
  const matches = useMemo(() => searchFilter(searchColumns, search), [search, searchColumns]);
  const shownRows = useMemo(() => (matches ? rows.filter(matches) : rows), [matches, rows]);
  // A group with none left is dropped, as its row would stand for nothing.
  const shownGroups = useMemo(
    () =>
      matches && groups
        ? groups
            .map((group) => ({ ...group, rows: group.rows.filter(matches) }))
            .filter((group) => group.rows.length > 0)
        : groups,
    [groups, matches],
  );

  // A selected mod the search hides is deselected, so nothing acts on a mod out of sight.
  const changeSearch = (next: string) => {
    if (search.trim() === "" && next.trim() !== "") {
      analytics.onSearchStarted();
    }
    setSearch(next);

    const nextMatches = searchFilter(searchColumns, next);
    if (nextMatches !== undefined) {
      setSelected(
        new Set(
          rows
            .filter((row) => selected.has(row.mod.id) && nextMatches(row))
            .map(({ mod }) => mod.id),
        ),
      );
    }
  };

  const displayOptions = useDisplayOptionsAction({
    label: t("View options"),
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

  const footer = multiSelected ? (
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
              aria-label={t("Selected mods enabled")}
              checked={selectedEnabled === selectedIds.length}
              indeterminate={selectedEnabled > 0 && selectedEnabled < selectedIds.length}
              isLoading={selectedIds.some((id) => changing.has(id))}
              onChange={(checked) => setEnabled(selectedIds, checked)}
            />
          }
        />
      </Toolbar>
    </TableSelectionBar>
  ) : undefined;

  const tableProps = {
    focusGroupId,
    onGroupFocused,
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
    getRowId: ({ mod }: IModRow) => mod.id,
    label: t("Mods"),
    selectable: true,
    getRowLabel: ({ name }: IModRow) => name,
    selectedIds: selected,
    onSelectedIdsChange: setSelected,
    rowMenu: ({ mod, name }: IModRow, close: () => void) =>
      multiSelected ? (
        <>
          <DropdownBlock>
            <Typography appearance="subdued" typographyType="body-sm">
              {t("{{count}} items selected", { count: selectedIds.length })}
            </Typography>
          </DropdownBlock>

          <DropdownDivider />

          <ToolbarMenu
            actions={selectionActions}
            label={t("Selected mods actions")}
            tracking={selectionTracking}
            onSelect={close}
          />
        </>
      ) : (
        <ToolbarMenu
          actions={actionsFor(mod.id)}
          label={t("{{name}} actions", { name })}
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
    empty: matches ? (
      <NoResults iconPath={mdiMagnify} title={t("No mods match your search")} />
    ) : undefined,
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
        onClose={() => setPendingDisable(undefined)}
        onDisableAll={() => disablePending(false)}
        onKeepShared={() => disablePending(true)}
      />
    </>
  );
};
