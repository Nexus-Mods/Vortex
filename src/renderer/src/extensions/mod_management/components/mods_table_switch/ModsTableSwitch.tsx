import { mdiAccount, mdiChevronRight } from "@mdi/js";
import React, { type ReactNode, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDisplayOptionsAction } from "@/ui/components/display_options/useDisplayOptionsAction.hook";
import { Switch } from "@/ui/components/form/switch/Switch";
import { Icon } from "@/ui/components/icon/Icon";
import { Image } from "@/ui/components/image/Image";
import { Table } from "@/ui/components/table/Table";
import type { ITableSort } from "@/ui/components/table/Table.types";
import { useDevSetting } from "@/views/components/dev_tools/useDevSetting.hook";

import { collectionsByMod } from "../../../collections/util/collectionsByMod";
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
  MODS_TABLE_PRESETS,
  sharedMods,
} from "../../util/modsTableViews";
import { DisableSharedModsModal } from "../disable_shared_mods_modal/DisableSharedModsModal";
import { ModsTableColumnToggles } from "../mods_table_column_toggles/ModsTableColumnToggles";
import { ModsTableToolbar } from "../mods_table_toolbar/ModsTableToolbar";

interface IModsTableSwitchProps {
  /** The mods the table lists, collections among them. */
  mods: { [id: string]: IModWithState };
  /** The table shown unless the dev tools "New table design" switch is on. */
  legacy: ReactNode;
  /** Enables or disables mods, installing any that are only downloaded first. */
  onSetModsEnabled: (modIds: string[], enabled: boolean) => void;
}

/** A group being disabled, while the user decides about the mods it shares. */
interface IPendingDisable {
  group: IModGroup;
  shared: ISharedMods;
}

const BY_NAME: ITableSort = { columnId: "name", direction: "ascending" };

const modIds = (rows: IModRow[]) => rows.map(({ mod }) => mod.id);

/** The Mods page's table: the legacy one, or the new table while it's being built. */
export const ModsTableSwitch = ({ mods, legacy, onSetModsEnabled }: IModsTableSwitchProps) => {
  const { t } = useTranslation(["common"]);
  const newTable = useDevSetting("newTable");

  const [view, setView] = useState(MODS_TABLE_PRESETS[0]);
  const groups = useMemo(() => groupMods(mods, view.grouping, t), [mods, view.grouping, t]);
  const rows = useMemo(() => allModRows(mods), [mods]);
  const memberships = useMemo(() => collectionsByMod(mods), [mods]);
  const [pendingDisable, setPendingDisable] = useState<IPendingDisable>();

  // Turning a group off asks first when other collections share some of its mods.
  const setGroupEnabled = useCallback(
    (group: IModGroup, enabled: boolean) => {
      const shared = sharedMods(group, memberships);

      if (enabled || shared.rows.length === 0) {
        onSetModsEnabled(modIds(group.rows), enabled);
        return;
      }

      setPendingDisable({ group, shared });
    },
    [memberships, onSetModsEnabled],
  );

  const disablePending = (keepShared: boolean) => {
    if (pendingDisable === undefined) {
      return;
    }

    const keep = new Set(keepShared ? modIds(pendingDisable.shared.rows) : []);
    onSetModsEnabled(
      modIds(pendingDisable.group.rows).filter((id) => !keep.has(id)),
      false,
    );
    setPendingDisable(undefined);
  };

  const dataColumns = useModsTableDataColumns(memberships);

  const columns = useMemo<IModsTableColumn[]>(
    () => [
      {
        id: "name",
        header: t("Name"),
        sort: (a, b) => a.name.localeCompare(b.name),
        cell: ({ mod, name }) => (
          <>
            {/* Where the row's expand button will go; for show until rows have something to expand. */}
            <span
              aria-hidden={true}
              className="flex size-5 shrink-0 items-center justify-center text-translucent-weak"
            >
              <Icon path={mdiChevronRight} size="sm" />
            </span>

            <Image
              alt=""
              className="ml-2 h-5 rounded-sm"
              fit="cover"
              imageType="mod"
              src={mod.attributes?.pictureUrl}
            />

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
        header: t("Status"),
        width: "42px",
        cell: ({ mod, name }) => (
          <Switch
            aria-label={t("{{name}} enabled", { name })}
            checked={!!mod.enabled}
            onChange={(enabled) => onSetModsEnabled([mod.id], enabled)}
          />
        ),
        // Part on while only some of its mods are, as after keeping the shared ones.
        groupCell: (group) => {
          const enabled = group.rows.filter(({ mod }) => mod.enabled).length;

          return (
            <Switch
              aria-label={t("{{name}} enabled", { name: group.label })}
              checked={group.rows.length > 0 && enabled === group.rows.length}
              indeterminate={enabled > 0 && enabled < group.rows.length}
              onChange={(checked) => setGroupEnabled(group, checked)}
            />
          );
        },
      },
      ...dataColumns,
    ],
    [dataColumns, onSetModsEnabled, setGroupEnabled, t],
  );

  const { visibleColumns, toggles, canReset, setColumnVisible, resetColumns } =
    useModsTableColumns(columns);

  const displayOptions = useDisplayOptionsAction({
    canReset,
    children: <ModsTableColumnToggles toggles={toggles} onToggle={setColumnVisible} />,
    onReset: resetColumns,
  });

  if (!newTable) {
    return <>{legacy}</>;
  }

  const tableProps = {
    className: "mb-2",
    toolbar: (
      <ModsTableToolbar displayOptions={displayOptions} view={view} onViewChange={setView} />
    ),
    columns: visibleColumns,
    getRowId: ({ mod }: IModRow) => mod.id,
    label: t("Mods"),
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
