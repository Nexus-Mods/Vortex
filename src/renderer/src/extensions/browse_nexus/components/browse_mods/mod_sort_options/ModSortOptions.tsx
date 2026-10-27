import React from "react";
import { useTranslation } from "react-i18next";

import { Picker } from "@/ui/components/picker/Picker";
import { PopoverPanelGroup } from "@/ui/components/popover/PopoverPanelGroup";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";

import type {
  IModSort,
  ModSortDirection,
  ModSortField,
  ModTimeRange,
} from "../../../hooks/use_mod_search/useModSearch.hook";

interface IModSortOptionsProps {
  /** How the open preset sorts the mods. */
  sort: IModSort;
  /** Changes some of it. */
  onChange: (change: Partial<IModSort>) => void;
}

/** The display options' section for how Browse's mods are sorted: by what, which way, and since when. */
export const ModSortOptions = ({ sort, onChange }: IModSortOptionsProps) => {
  const { t } = useTranslation();

  return (
    <PopoverPanelGroup>
      <PopoverPanelGroupItem passive label={t("Sort by")}>
        <Picker<ModSortField>
          button={{ size: "sm" }}
          options={[
            { label: t("Trending"), value: "trending" },
            { label: t("Downloads"), value: "popular" },
            { label: t("Endorsements"), value: "endorsements" },
            { label: t("Date added"), value: "new" },
            { label: t("Date updated"), value: "updated" },
          ]}
          value={sort.field}
          onChange={(field) => onChange({ field })}
        />
      </PopoverPanelGroupItem>

      <PopoverPanelGroupItem passive label={t("Order")}>
        <Picker<ModSortDirection>
          button={{ size: "sm" }}
          options={[
            { label: t("Descending"), value: "desc" },
            { label: t("Ascending"), value: "asc" },
          ]}
          value={sort.direction}
          onChange={(direction) => onChange({ direction })}
        />
      </PopoverPanelGroupItem>

      <PopoverPanelGroupItem passive label={t("From")}>
        <Picker<ModTimeRange>
          button={{ size: "sm" }}
          options={[
            { label: t("Last 24 hours"), value: "1" },
            { label: t("Last 7 days"), value: "7" },
            { label: t("Last 14 days"), value: "14" },
            { label: t("Last 28 days"), value: "28" },
            { label: t("Last year"), value: "365" },
            { label: t("All time"), value: "all" },
          ]}
          value={sort.timeRange}
          onChange={(timeRange) => onChange({ timeRange })}
        />
      </PopoverPanelGroupItem>
    </PopoverPanelGroup>
  );
};
