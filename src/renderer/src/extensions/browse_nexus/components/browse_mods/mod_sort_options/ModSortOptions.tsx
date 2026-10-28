import type { TFunction } from "i18next";
import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Picker } from "@/ui/components/picker/Picker";
import { PopoverPanelGroup } from "@/ui/components/popover/PopoverPanelGroup";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";

import type {
  IModSort,
  ModSortField,
  ModTimeRange,
} from "../../../hooks/use_mod_search/useModSearch.hook";

interface IModSortOptionsProps {
  /** How the open preset sorts the mods. */
  sort: IModSort;
  /** Changes some of it. */
  onChange: (change: Partial<IModSort>) => void;
}

/** The sorts by a date, ordered by age rather than size. */
const DATE_FIELDS: readonly ModSortField[] = ["new", "updated"];

/** How the mods are ordered, in words for what they're sorted by: by age for dates, else by size. */
const orderLabel = (t: TFunction, { field, direction }: IModSort) => {
  if (DATE_FIELDS.includes(field)) {
    return direction === "asc" ? t("Oldest first") : t("Newest first");
  }

  return direction === "asc" ? t("Lowest first") : t("Highest first");
};

/**
 * The display options' section for how Browse's mods are sorted: by what, which way, and since
 * when. Which way is a button beside what they're sorted by that turns the order round, its
 * tooltip saying how they're ordered now and its list arrow pointing down for descending and up
 * for ascending. The font has only the down one, so the up one is it flipped.
 */
export const ModSortOptions = ({ sort, onChange }: IModSortOptionsProps) => {
  const { t } = useTranslation();
  const isAscending = sort.direction === "asc";
  const order = orderLabel(t, sort);

  return (
    <PopoverPanelGroup>
      <PopoverPanelGroupItem passive label={t("Sort by")}>
        <div className="flex items-center gap-x-1">
          <Tooltip closeOnPress={false} content={order}>
            <Button
              appearance="weak"
              aria-label={order}
              brand="neutral"
              leftIcon={
                <Icon className={isAscending ? "-scale-y-100" : undefined} name="list_arrow" />
              }
              size="sm"
              onClick={() => onChange({ direction: isAscending ? "desc" : "asc" })}
            />
          </Tooltip>

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
        </div>
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
