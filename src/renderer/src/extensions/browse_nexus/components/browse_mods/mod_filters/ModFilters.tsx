import React from "react";
import { useTranslation } from "react-i18next";

import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import { Typography } from "@/ui/components/typography/Typography";

import { MOD_FILTERS } from "../../../util/mod_filters/modFilterList";
import type { IModFilters } from "../../../util/mod_views/modViews";
import { FilterReset } from "./FilterReset";
import { ModFilterMenu } from "./ModFilterMenu";

interface IModFiltersProps {
  /** Which mods the open view shows. */
  filters: IModFilters;
  /** Which of them narrow the mods, which their rows mark. */
  activeFilters: Array<keyof IModFilters>;
  /** Which of them differ from the view's own, which the resets put back. */
  changedFilters: Array<keyof IModFilters>;
  /** Whether the user's content preferences show adult content. */
  canSeeAdult: boolean;
  /** Whether the user is logged in. */
  isLoggedIn: boolean;
  /** Changes some of them. */
  onChange: (change: Partial<IModFilters>) => void;
  /** Puts one back as the view has it. */
  onResetFilter: (key: keyof IModFilters) => void;
  /** Puts them all back as the view has them. */
  onReset: () => void;
  /** Dismisses the filters once one's been picked. */
  onSelect: () => void;
}

/**
 * The filter button's menu for Browse's mods: a row for each filter, with a pip while it narrows
 * the mods, opening its submenu; a note that more are coming; and, while any differs from the
 * view's own, a reset that puts them back.
 */
export const ModFilters = ({
  filters,
  activeFilters,
  changedFilters,
  canSeeAdult,
  isLoggedIn,
  onChange,
  onResetFilter,
  onReset,
  onSelect,
}: IModFiltersProps) => {
  const { t } = useTranslation();
  const changedCount = changedFilters.length;

  return (
    <>
      <PopoverMenu
        actions={[
          MOD_FILTERS.map((filter) => ({
            label: filter.label(t),
            icon: filter.icon,
            hasPip: activeFilters.includes(filter.key),
            panelRole: "menu",
            panel: ({ close, dismiss }) => (
              <ModFilterMenu
                canSeeAdult={canSeeAdult}
                filter={filter}
                filters={filters}
                isLoggedIn={isLoggedIn}
                onChange={onChange}
                onClose={close}
                onReset={
                  changedFilters.includes(filter.key) ? () => onResetFilter(filter.key) : undefined
                }
                onSelect={dismiss}
              />
            ),
          })),
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
        <FilterReset
          label={
            changedCount === 1
              ? t("Reset 1 filter to default")
              : t("Reset {{count}} filters to default", { count: changedCount })
          }
          onReset={onReset}
        />
      )}
    </>
  );
};
