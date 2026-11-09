import React from "react";
import { useTranslation } from "react-i18next";

import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import { Typography } from "@/ui/components/typography/Typography";

import type { IAdultContentAccess, IModFilter } from "../../../util/mod_filters/modFilter.types";
import type { IModFilters } from "../../../util/mod_views/modViews";
import { FilterReset } from "./FilterReset";

interface IModFilterMenuProps extends IAdultContentAccess {
  /** The filter it's for. */
  filter: IModFilter;
  /** Which mods the open view shows, as the user sees them. */
  filters: IModFilters;
  /** Changes the filter. */
  onChange: (change: Partial<IModFilters>) => void;
  /** Dismisses the menu, and whatever opened it, once a choice has been picked. */
  onSelect: () => void;
  /** Goes back to the menu this one opened from, for a submenu. */
  onClose?: () => void;
  /** Puts the filter back as the view has it, offered while it differs. */
  onReset?: () => void;
}

/**
 * A filter's choices, the one on checked: its submenu in the Filter menu, with a reset while it
 * differs from the view's own, and the menu its chip opens. While the filter's locked, every choice
 * is off and the menu says why.
 */
export const ModFilterMenu = ({
  filter,
  filters,
  canSeeAdult,
  isLoggedIn,
  onChange,
  onSelect,
  onClose,
  onReset,
}: IModFilterMenuProps) => {
  const { t } = useTranslation();
  const locked = filter.lockedReason?.(t, { canSeeAdult, isLoggedIn });

  return (
    <>
      <PopoverMenu
        actions={[
          filter.choices(t).map(({ value, label }) => ({
            label,
            checked: filters[filter.key] === value,
            disabled: !!locked,
            onClick: () => onChange({ [filter.key]: value }),
          })),
        ]}
        label={filter.label(t)}
        onClose={onClose}
        onSelect={onSelect}
      />

      {!!locked && (
        <Typography appearance="subdued" className="mx-1 px-1.5 py-2" typographyType="body-sm">
          {locked}
        </Typography>
      )}

      {!!onReset && <FilterReset label={filter.resetLabel(t)} onReset={onReset} />}
    </>
  );
};
