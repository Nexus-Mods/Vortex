import React, { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Switch } from "@/ui/components/form/switch/Switch";
import { Image } from "@/ui/components/image/Image";
import { Table } from "@/ui/components/table/Table";
import type { ITableColumn, ITableGroup } from "@/ui/components/table/Table.types";
import { useDevSetting } from "@/views/components/dev_tools/useDevSetting.hook";

import { MOD_TYPE as COLLECTION_TYPE } from "../../collections/constants";
import { collectionsByMod } from "../../collections/util/collectionsByMod";
import type { IMod } from "../types/IMod";
import type { IModWithState } from "../types/IModProps";
import modName from "../util/modName";

interface IModsTableSwitchProps {
  mods: { [id: string]: IModWithState };
  /** The table shown unless the dev tools "New table design" switch is on. */
  legacy: ReactNode;
}

interface IModRow {
  mod: IModWithState;
  name: string;
}

interface IModGroup extends ITableGroup<IModRow> {
  /** The collection the group is for, or undefined for the mods in none. */
  collection?: IMod;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/**
 * The mods from no collection, then the mods grouped by the collections they came from.
 * Without a collection there's nothing to group by, so that's undefined.
 */
const groupByCollection = (
  mods: { [id: string]: IModWithState },
  noCollectionLabel: string,
): IModGroup[] | undefined => {
  const memberships = collectionsByMod(mods);
  const rows = Object.values(mods)
    .filter((mod) => mod.type !== COLLECTION_TYPE)
    .map((mod) => ({ mod, name: modName(mod) }))
    .sort(byName);

  const collectionGroups = Object.values(mods)
    .filter((mod) => mod.type === COLLECTION_TYPE)
    .map((collection) => ({ collection, name: modName(collection) }))
    .sort(byName)
    .map(({ collection, name }) => ({
      id: collection.id,
      label: name,
      collection,
      image: collection.attributes?.pictureUrl,
      rows: rows.filter(({ mod }) =>
        (memberships[mod.id] ?? []).some((member) => member.id === collection.id),
      ),
    }));

  if (collectionGroups.length === 0) {
    return undefined;
  }

  const ungrouped = rows.filter(({ mod }) => (memberships[mod.id] ?? []).length === 0);

  return [
    ...(ungrouped.length > 0
      ? [{ id: "no-collection", label: noCollectionLabel, rows: ungrouped }]
      : []),
    ...collectionGroups,
  ];
};

/** The Mods page's table: the legacy one, or the new table while it's being built. */
export const ModsTableSwitch = ({ mods, legacy }: IModsTableSwitchProps) => {
  const { t } = useTranslation(["common"]);
  const newTable = useDevSetting("newTable");

  const groups = useMemo(() => groupByCollection(mods, t("No collection")), [mods, t]);

  const columns = useMemo<Array<ITableColumn<IModRow, IModGroup>>>(
    () => [
      {
        id: "name",
        header: t("Name"),
        cell: ({ mod, name }) => (
          <>
            {/* Where the row's expand button will go, so names line up under their group's. */}
            <span className="size-5 shrink-0" />

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
        groupCell: ({ collection, label, rows }) => (
          <>
            {!!collection && (
              <Image
                alt=""
                className="ml-2 h-8 rounded-xs"
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
    className: "my-2",
    columns,
    getRowId: ({ mod }: IModRow) => mod.id,
    label: t("Mods"),
  };

  return groups === undefined ? (
    <Table
      {...tableProps}
      rows={Object.values(mods)
        .map((mod) => ({ mod, name: modName(mod) }))
        .sort(byName)}
    />
  ) : (
    <Table {...tableProps} groups={groups} />
  );
};
