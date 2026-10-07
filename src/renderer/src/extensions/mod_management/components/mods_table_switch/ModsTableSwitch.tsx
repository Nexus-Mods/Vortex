import { mdiAccount } from "@mdi/js";
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

import type { ITableRowAction } from "@/controls/Table";
import type { IState } from "@/types/IState";
import { useDisplayOptionsAction } from "@/ui/components/display_options/useDisplayOptionsAction.hook";
import { Switch } from "@/ui/components/form/switch/Switch";
import { Image } from "@/ui/components/image/Image";
import { Table } from "@/ui/components/table/Table";
import type { ITableSort, TableColumnWidth } from "@/ui/components/table/Table.types";
import { useTableRowEngaged } from "@/ui/components/table/TableRow.context";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { type IToolbarAction, ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { useDevSetting } from "@/views/components/dev_tools/useDevSetting.hook";

import { collectionsByMod } from "../../../collections/util/collectionsByMod";
import { activeProfile } from "../../../profile_management/selectors";
import {
  MOD_ROW_PINNING_ID,
  useModRowActions,
} from "../../hooks/use_mod_row_actions/useModRowActions.hook";
import {
  type IModsTableColumn,
  useModsTableColumns,
} from "../../hooks/use_mods_table_columns/useModsTableColumns.hook";
import { useModsTableDataColumns } from "../../hooks/use_mods_table_data_columns/useModsTableDataColumns.hook";
import type { IModWithState } from "../../types/IModProps";
import {
  allModRows,
  groupMods,
  type IModGroup,
  type IModRow,
  type ISharedMods,
  type ModsTableGrouping,
  sharedMods,
} from "../../util/mods_table_views/modsTableViews";
import { DisableSharedModsModal } from "../disable_shared_mods_modal/DisableSharedModsModal";
import { ModThumbnail } from "../mod_thumbnail/ModThumbnail";
import { ModsTableColumnToggles } from "../mods_table_column_toggles/ModsTableColumnToggles";
import { ModsTableGroupBy } from "../mods_table_group_by/ModsTableGroupBy";
import { ModsTableToolbar } from "../mods_table_toolbar/ModsTableToolbar";

interface IModsTableSwitchProps {
  /** The mods the table lists, collections among them. */
  mods: { [id: string]: IModWithState };
  /** The table shown unless the dev tools "New table design" switch is on. */
  legacy: ReactNode;
  /** Enables or disables mods, installing any that are only downloaded first; settles once done. */
  onSetModsEnabled: (modIds: string[], enabled: boolean) => void | PromiseLike<unknown>;
  /** The legacy table's row actions, offered in each row's menu with the extensions' own. */
  rowActions?: ITableRowAction[];
}

/** A group being disabled, while the user decides about the mods it shares. */
interface IPendingDisable {
  group: IModGroup;
  shared: ISharedMods;
}

const BY_NAME: ITableSort = { columnId: "name", direction: "ascending" };

const modIds = (rows: IModRow[]) => rows.map(({ mod }) => mod.id);

const profileModState = (state: IState) => activeProfile(state)?.modState;

/** The Mods page's table: the legacy one, or the new table while it's being built. */
const NO_ROW_ACTIONS: ITableRowAction[] = [];

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
  modId: string;
  /** The switch's name. */
  label: string;
  enabled: boolean;
  isLoading: boolean;
  onSetEnabled: (modIds: string[], enabled: boolean) => void;
}

/**
 * A row's pinned actions, its switch, then its menu of every action. Against the cell's end,
 * as a group row's switch is, and as wide as the pins need so none collapse: at rest they
 * overhang the column, hidden, and the cell widens over them while the row is hovered.
 *
 * Only the switch renders until the row is first pointed at or focused, in the place the
 * toolbar puts it: the pins and the menu are hidden at rest, and a toolbar per row is costly
 * to mount as rows scroll in. Then the toolbar mounts and stays while the row does, so a menu
 * opened from it isn't torn down. Memoized, since rows re-render on each frame of a scroll.
 */
const ModRowActions = memo(
  ({ actions, width, modId, label, enabled, isLoading, onSetEnabled }: IModRowActionsProps) => {
    const engaged = useTableRowEngaged();
    const restingRef = useRef<HTMLDivElement>(null);
    // the cell, while the resting switch has focus as the toolbar replaces it
    const refocusIn = useRef<HTMLElement | null>(null);

    useLayoutEffect(() => {
      if (engaged && refocusIn.current !== null) {
        refocusIn.current.querySelector<HTMLElement>(".nxm-switch")?.focus();
        refocusIn.current = null;
      }
    }, [engaged]);

    const toggle = (
      <Switch
        aria-label={label}
        checked={enabled}
        isLoading={isLoading}
        onChange={(checked) => onSetEnabled([modId], checked)}
      />
    );

    if (!engaged) {
      return (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end gap-x-2"
          ref={restingRef}
          style={{ width }}
          onFocus={() => (refocusIn.current = restingRef.current?.parentElement ?? null)}
        >
          {toggle}

          <span aria-hidden className="w-7 shrink-0" />
        </div>
      );
    }

    return (
      <Toolbar
        className="absolute inset-y-0 right-0 justify-end"
        pinTarget="row"
        pinningId={MOD_ROW_PINNING_ID}
        style={{ width }}
      >
        <ToolbarGroup actions={actions} beforeOverflow={toggle} />
      </Toolbar>
    );
  },
);

export const ModsTableSwitch = ({
  mods,
  legacy,
  onSetModsEnabled,
  rowActions = NO_ROW_ACTIONS,
}: IModsTableSwitchProps) => {
  const { t } = useTranslation(["common"]);
  const newTable = useDevSetting("newTable");

  const [grouping, setGrouping] = useState<ModsTableGrouping>("none");
  const rows = useMemo(() => allModRows(mods), [mods]);
  const memberships = useMemo(() => collectionsByMod(mods), [mods]);
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

  // Turning a group off asks first when other collections share some of its mods.
  const setGroupEnabled = useCallback(
    (group: IModGroup, enabled: boolean) => {
      const shared = sharedMods(group, memberships);

      if (enabled || shared.rows.length === 0) {
        setEnabled(modIds(group.rows), enabled);
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
      modIds(pendingDisable.group.rows).filter((id) => !keep.has(id)),
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

  const columns = useMemo<IModsTableColumn[]>(
    () => [
      {
        id: "name",
        header: t("Name"),
        sort: (a, b) => a.name.localeCompare(b.name),
        cell: ({ mod, name }) => (
          <>
            <ModThumbnail className="ml-2 h-5 rounded-sm" pictureUrl={mod.attributes?.pictureUrl} />

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
              <Image
                alt=""
                className="ml-3 h-8 rounded-xs"
                fit="cover"
                imageType="collection"
                src={collection.attributes?.pictureUrl}
              />
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
        revealWidth: pinnedCount > 0 ? `${PINNED_ACTION_WIDTH * pinnedCount}px` : undefined,
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
        cell: ({ mod, name }) => (
          <ModRowActions
            actions={actionsFor(mod.id)}
            width={actionsWidth(pinnedCount)}
            enabled={isEnabled(mod)}
            isLoading={changing.has(mod.id)}
            label={t("{{name}} enabled", { name })}
            modId={mod.id}
            onSetEnabled={setEnabled}
          />
        ),
        // Part on while only some of its mods are, as after keeping the shared ones.
        groupCell: (group) => {
          const enabled = group.rows.filter(({ mod }) => isEnabled(mod)).length;

          // Against the end, past room for a menu, so it lines up with its rows' switches.
          return (
            <div className="flex w-full items-center justify-end gap-x-2">
              <Switch
                aria-label={t("{{name}} enabled", { name: group.label })}
                checked={group.rows.length > 0 && enabled === group.rows.length}
                indeterminate={enabled > 0 && enabled < group.rows.length}
                isLoading={group.rows.some(({ mod }) => changing.has(mod.id))}
                onChange={(checked) => setGroupEnabled(group, checked)}
              />

              <span aria-hidden className="w-7 shrink-0" />
            </div>
          );
        },
      },
      ...dataColumns,
    ],
    [actionsFor, changing, dataColumns, isEnabled, pinnedCount, setEnabled, setGroupEnabled, t],
  );

  const { visibleColumns, toggles, groupable, canReset, setColumnVisible, resetColumns } =
    useModsTableColumns(columns);

  // Regroups when the grouped-by column changes, not whenever any column does, as Status does on each switch.
  const groupColumn = groupable.find((column) => column.id === grouping);
  const groups = useMemo(
    () => groupMods(mods, grouping, t, groupColumn),
    [mods, grouping, t, groupColumn],
  );

  const displayOptions = useDisplayOptionsAction({
    canReset: canReset || grouping !== "none",
    children: (
      <>
        <ModsTableGroupBy columns={groupable} grouping={grouping} onChange={setGrouping} />

        <ModsTableColumnToggles toggles={toggles} onToggle={setColumnVisible} />
      </>
    ),
    onReset: () => {
      resetColumns();
      setGrouping("none");
    },
  });

  if (!newTable) {
    return <>{legacy}</>;
  }

  const tableProps = {
    className: "mb-2",
    toolbar: (
      <ModsTableToolbar
        displayOptions={displayOptions}
        grouping={grouping}
        onGroupingChange={setGrouping}
      />
    ),
    columns: visibleColumns,
    getRowId: ({ mod }: IModRow) => mod.id,
    label: t("Mods"),
    selectable: true,
    getRowLabel: ({ name }: IModRow) => name,
    defaultSort: BY_NAME,
  };

  // A table takes rows or groups, never both; typed, so neither gains the other as undefined.
  const data: { groups: IModGroup[] } | { rows: IModRow[] } = groups ? { groups } : { rows };

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
