import { mdiAccount, mdiChevronRight } from "@mdi/js";
import React, { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Switch } from "@/ui/components/form/switch/Switch";
import { Icon } from "@/ui/components/icon/Icon";
import { Image } from "@/ui/components/image/Image";
import { Table } from "@/ui/components/table/Table";
import type { ITableColumn } from "@/ui/components/table/Table.types";
import { useDevSetting } from "@/views/components/dev_tools/useDevSetting.hook";

import type { IModWithState } from "../../types/IModProps";
import {
  allModRows,
  groupMods,
  type IModGroup,
  type IModRow,
  MODS_TABLE_PRESETS,
} from "../../util/modsTableViews";
import { ModsTableToolbar } from "../ModsTableToolbar/ModsTableToolbar";

interface IModsTableSwitchProps {
  mods: { [id: string]: IModWithState };
  /** The table shown unless the dev tools "New table design" switch is on. */
  legacy: ReactNode;
}

/** The Mods page's table: the legacy one, or the new table while it's being built. */
export const ModsTableSwitch = ({ mods, legacy }: IModsTableSwitchProps) => {
  const { t } = useTranslation(["common"]);
  const newTable = useDevSetting("newTable");

  const [view, setView] = useState(MODS_TABLE_PRESETS[0]);
  const groups = useMemo(() => groupMods(mods, view.grouping, t), [mods, view.grouping, t]);
  const rows = useMemo(() => allModRows(mods), [mods]);

  const columns = useMemo<Array<ITableColumn<IModRow, IModGroup>>>(
    () => [
      {
        id: "name",
        header: t("Name"),
        cell: ({ mod, name }) => (
          <>
            {/* Where the row's expand button will go; for show until rows have something to expand. */}
            <span
              aria-hidden={true}
              className="flex size-5 shrink-0 items-center justify-center text-neutral-moderate"
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
        // Read-only for now: no onChange, so it shows the state without changing it.
        cell: ({ mod, name }) => (
          <Switch aria-label={t("{{name}} enabled", { name })} checked={!!mod.enabled} />
        ),
        groupCell: ({ label, rows }) => {
          const enabled = rows.filter(({ mod }) => mod.enabled).length;

          return (
            <Switch
              aria-label={t("{{name}} enabled", { name: label })}
              checked={rows.length > 0 && enabled === rows.length}
              indeterminate={enabled > 0 && enabled < rows.length}
            />
          );
        },
      },
    ],
    [t],
  );

  if (!newTable) {
    return <>{legacy}</>;
  }

  const tableProps = {
    className: "mb-2",
    toolbar: <ModsTableToolbar view={view} onViewChange={setView} />,
    columns,
    getRowId: ({ mod }: IModRow) => mod.id,
    label: t("Mods"),
  };

  return groups === undefined ? (
    <Table {...tableProps} rows={rows} />
  ) : (
    <Table {...tableProps} groups={groups} />
  );
};
