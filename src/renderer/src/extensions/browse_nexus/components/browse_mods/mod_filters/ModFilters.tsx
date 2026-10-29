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

interface IModFiltersProps {
  /** Which mods the open view shows. */
  filters: IModFilters;
  /** How many of them narrow the mods, which the reset counts. */
  activeCount: number;
  /** Changes some of them. */
  onChange: (change: Partial<IModFilters>) => void;
  /** Clears every one. */
  onReset: () => void;
  /** Dismisses the filters once one's been picked. */
  onSelect: () => void;
}

/**
 * The filter button's menu for Browse's mods: Dates, opening a submenu of time ranges with the
 * one on checked, a note that more are coming, and, while any filter is on, a reset that clears
 * them all.
 */
export const ModFilters = ({
  filters,
  activeCount,
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
              panelRole: "menu",
              panel: ({ close, dismiss }) => (
                <PopoverMenu
                  actions={[
                    timeRanges(t).map(({ value, label }) => ({
                      label,
                      checked: filters.timeRange === value,
                      onClick: () => onChange({ timeRange: value }),
                    })),
                  ]}
                  label={t("Dates")}
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

      {!!activeCount && (
        <>
          <DropdownDivider className="mt-1" />

          <PopoverPanelGroupItem className="h-auto justify-end py-3">
            <TypographyLink
              brand="info"
              typographyType="body-sm"
              variant="secondary"
              onClick={onReset}
            >
              {activeCount === 1
                ? t("Reset 1 filter to default")
                : t("Reset {{count}} filters to default", { count: activeCount })}
            </TypographyLink>
          </PopoverPanelGroupItem>
        </>
      )}
    </>
  );
};
