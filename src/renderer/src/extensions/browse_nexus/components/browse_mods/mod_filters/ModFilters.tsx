import type { TFunction } from "i18next";
import React from "react";
import { useTranslation } from "react-i18next";

import { DropdownDivider } from "@/ui/components/dropdown/DropdownDivider";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";
import { Typography } from "@/ui/components/typography/Typography";
import { TypographyLink } from "@/ui/components/typography/TypographyLink";

import type { IModFilters, ModTimeRange } from "../../../hooks/use_mod_search/useModSearch.hook";

/** Each time range, in the Dates submenu's words, and briefly, as the bar shows the one on. */
export const timeRanges = (
  t: TFunction,
): Array<{ value: ModTimeRange; label: string; short: string }> => [
  { value: "1", label: t("Last 24 hours"), short: t("24 hours") },
  { value: "7", label: t("Last 7 days"), short: t("7 days") },
  { value: "14", label: t("Last 14 days"), short: t("14 days") },
  { value: "28", label: t("Last 28 days"), short: t("28 days") },
  { value: "365", label: t("Last year"), short: t("1 year") },
  { value: "all", label: t("All time"), short: t("All time") },
];

interface IModTimeRangeMenuProps {
  /** The time range that's on, which the menu checks. */
  timeRange: ModTimeRange;
  /** Told the time range picked. */
  onChange: (timeRange: ModTimeRange) => void;
  /** Dismisses the menu, and whatever opened it, once a time range has been picked. */
  onSelect: () => void;
  /** Goes back to the menu this one opened from, for a submenu. */
  onClose?: () => void;
}

/**
 * The time ranges to pick from, the one on checked: the filters' Dates submenu, and the menu the
 * bar's time range opens.
 */
export const ModTimeRangeMenu = ({
  timeRange,
  onChange,
  onSelect,
  onClose,
}: IModTimeRangeMenuProps) => {
  const { t } = useTranslation();

  return (
    <PopoverMenu
      actions={[
        timeRanges(t).map(({ value, label }) => ({
          label,
          checked: timeRange === value,
          onClick: () => onChange(value),
        })),
      ]}
      label={t("Dates")}
      onClose={onClose}
      onSelect={onSelect}
    />
  );
};

interface IModFiltersProps {
  /** Which mods the open view shows. */
  filters: IModFilters;
  /** How many of them differ from the view's own, which the reset counts. */
  changedCount: number;
  /** Changes some of them. */
  onChange: (change: Partial<IModFilters>) => void;
  /** Puts them back as the view has them. */
  onReset: () => void;
  /** Dismisses the filters once one's been picked. */
  onSelect: () => void;
}

/**
 * The filter button's menu for Browse's mods: Dates, with a pip while a time range is on, opening
 * a submenu of time ranges with the one on checked, a note that more are coming, and, while any
 * differs from the view's own, a reset that puts them back.
 */
export const ModFilters = ({
  filters,
  changedCount,
  onChange,
  onReset,
  onSelect,
}: IModFiltersProps) => {
  const { t } = useTranslation();

  return (
    <>
      <PopoverMenu
        actions={[
          [
            {
              label: t("Dates"),
              icon: "calendar_today",
              hasPip: filters.timeRange !== "all",
              panelRole: "menu",
              panel: ({ close, dismiss }) => (
                <ModTimeRangeMenu
                  timeRange={filters.timeRange}
                  onChange={(timeRange) => onChange({ timeRange })}
                  onClose={close}
                  onSelect={dismiss}
                />
              ),
            },
          ],
        ]}
        label={t("Filters")}
        onSelect={onSelect}
      />

      <Typography
        appearance="subdued"
        className="mx-1 flex h-8 items-center px-1.5 italic"
        typographyType="body-sm"
      >
        {t("More filters coming soon...")}
      </Typography>

      {!!changedCount && (
        <>
          <DropdownDivider className="mt-1" />

          <PopoverPanelGroupItem className="h-auto justify-end py-3">
            <TypographyLink
              brand="info"
              typographyType="body-sm"
              variant="secondary"
              onClick={onReset}
            >
              {changedCount === 1
                ? t("Reset 1 filter to default")
                : t("Reset {{count}} filters to default", { count: changedCount })}
            </TypographyLink>
          </PopoverPanelGroupItem>
        </>
      )}
    </>
  );
};
