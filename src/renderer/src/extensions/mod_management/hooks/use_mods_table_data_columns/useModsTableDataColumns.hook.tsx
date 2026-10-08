import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";
import type { TableColumnWidth } from "@/ui/components/table/Table.types";
import { getCurrentLanguage } from "@/util/i18n";
import { userFriendlyTime } from "@/util/relativeTime";
import { activeGameId } from "@/util/selectors";

import { getModType } from "../../../gamemode_management/util/modTypeExtensions";
import type { IMod } from "../../types/IMod";
import modName from "../../util/modName";
import type { IModRow } from "../../util/mods_table_views/modsTableViews";
import { getModSources } from "../../util/modSource";
import type { IModsTableColumn } from "../use_mods_table_columns/useModsTableColumns.hook";

const downloadFiles = (state: IState) => state.persistent.downloads.files;

const gameCategories = (state: IState) => state.persistent.categories[activeGameId(state)];

/** A mod's first category, as `resolveCategoryName` takes it: a number, or ids in a string. */
const categoryId = (category: string | number | undefined) =>
  category ? category.toString().split(",")[0] : undefined;

const timeOf = (value: string | number | Date | undefined) =>
  value === undefined ? undefined : new Date(value).getTime() || undefined;

/** A toggleable column showing a line of text, sorted, grouped and searched by it. */
const textColumn = (
  id: string,
  header: string,
  width: TableColumnWidth,
  text: (row: IModRow) => string,
): IModsTableColumn => ({
  id,
  header,
  width,
  isToggleable: true,
  isDefaultVisible: false,
  sort: (a, b) => text(a).localeCompare(text(b)),
  groupBy: text,
  searchText: text,
  cell: (row) => <span className="truncate">{text(row)}</span>,
});

/**
 * The toggleable columns that show a value of the mod's. Ids and positions are the legacy
 * table's, whose column choices and order these share. The comments mark the columns
 * still to come, each needing more than a value: they're ported one at a time.
 */
export const useModsTableDataColumns = (memberships: {
  [modId: string]: IMod[];
}): IModsTableColumn[] => {
  const { t } = useTranslation(["common"]);
  const downloads = useSelector(downloadFiles);
  const categories = useSelector(gameCategories);

  return useMemo(() => {
    /** A toggleable column showing a time relative to now, newest last; searched as shown. */
    const timeColumn = (
      id: string,
      header: string,
      time: (row: IModRow) => number | undefined,
      missing: string,
    ): IModsTableColumn => {
      const text = (row: IModRow) => {
        const value = time(row);
        return value === undefined
          ? missing
          : userFriendlyTime(new Date(value), t, getCurrentLanguage());
      };

      return {
        id,
        header,
        width: "140px",
        isToggleable: true,
        isDefaultVisible: false,
        sort: (a, b) => (time(a) ?? 0) - (time(b) ?? 0),
        searchText: text,
        cell: (row) => <span className="truncate">{text(row)}</span>,
      };
    };

    return [
      // Version (`version`, 40): its update and changelog buttons, and the other versions
      // of the mod, which the legacy table groups under it.
      {
        ...textColumn("author", t("Author"), "160px", ({ mod }) => mod.attributes?.author ?? ""),
        position: 50,
      },
      {
        ...textColumn(
          "archiveName",
          t("Archive name"),
          "200px",
          ({ mod }) => downloads[mod.archiveId]?.localPath ?? "",
        ),
        position: 60,
      },
      // Mod size (`modSize`, 100): an installed mod's size is only known once the user asks
      // for it to be calculated, from the folder on disk.
      // The other extensions' columns have no position, so they take 100 and come in the
      // order the extensions load, after ModList's own.
      textColumn("category", t("Category"), "160px", ({ mod }) => {
        const id = categoryId(mod.attributes?.category);
        return (id !== undefined ? categories?.[id]?.name : undefined) ?? "";
      }),
      textColumn(
        "modType",
        t("Mod type"),
        "120px",
        ({ mod }) => getModType(mod.type)?.options.name || mod.type,
      ),
      textColumn(
        "modSource",
        t("Source"),
        "120px",
        ({ mod }) =>
          getModSources().find((source) => source.id === mod.attributes?.source)?.name ?? "",
      ),
      // Endorsed (`endorsed`, nexus_integration): the endorse button, which needs the
      // user's Nexus account and the mod's collection.
      // Tracking (`tracked`, nexus_integration): the mods a user tracks are fetched from
      // Nexus and kept outside the store.
      {
        ...textColumn("collection", t("Collection"), "180px", ({ mod }) =>
          (memberships[mod.id] ?? [])
            .map((collection) => modName(collection))
            .sort((a, b) => a.localeCompare(b))
            .join(", "),
        ),
        isDefaultVisible: true,
      },
      // Content (`content`, mod-content): icons for what a mod holds, scanned from its
      // staging folder when first shown.
      // Deploy order (`loadOrder`, mod-dependency-manager): computed from the dependency
      // sort, outside the store.
      // Dependencies (`dependencies`, mod-dependency-manager): its icon is dragged between
      // rows to make rules, and needs the extension's dependency state.
      // Highlight (`modHighlight`, mod-highlight): the colour and icon picker, and notes.
      // Game-specific, each needing per-game `condition` support first:
      // Compatibility (`sdv-compatibility`, game-stardewvalley): Stardew Valley only.
      // Game(s) (`gameType`, game-masterchiefcollection): Halo: MCC only.
      // Extender Error (`script-extender-error-check`): script-extender games, not toggleable.
      {
        ...timeColumn(
          "installTime",
          t("Installation time"),
          ({ mod }) => timeOf(mod.attributes?.installTime),
          t("Not installed"),
        ),
        isDefaultVisible: true,
        position: 110,
      },
      {
        ...timeColumn(
          "enabledTime",
          t("Enabled time"),
          ({ mod }) => timeOf(mod.enabledTime),
          t("Never"),
        ),
        position: 120,
      },
      {
        ...timeColumn(
          "downloadTime",
          t("Downloaded time"),
          ({ mod }) => timeOf(downloads[mod.archiveId]?.fileTime),
          t("Unknown"),
        ),
        position: 130,
      },
    ];
  }, [categories, downloads, memberships, t]);
};
