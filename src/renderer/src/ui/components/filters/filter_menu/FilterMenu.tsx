import React from "react";

import type { IIconProp } from "@/ui/components/icon/Icon";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import type { IPopoverPanel } from "@/ui/components/popover/popover_menu/PopoverMenu.types";
import { Typography } from "@/ui/components/typography/Typography";

import { FilterReset } from "../FilterReset";

/** One filter in the Filter menu, opening its submenu. */
export interface IFilterMenuItem {
  /** Its row, and its submenu's name. */
  label: string;
  /** Its row's icon. */
  icon: IIconProp;
  /** Its submenu. */
  panel: IPopoverPanel;
}

interface IFilterMenuProps {
  /** The menu's accessible name. */
  label: string;
  /** The filters, in order. */
  items: IFilterMenuItem[];
  /** The note under them that more are coming. */
  comingSoon: string;
  /** The reset's text, shown with `onReset`. */
  resetLabel?: string;
  /** Puts every filter back as the view has it; unset, there's no reset. */
  onReset?: () => void;
  /** Dismisses the menu once a choice ends the interaction. */
  onSelect: () => void;
}

/**
 * A filter button's menu: a row for each filter, opening its submenu; a note that more are coming;
 * and, given one, a reset that puts them back.
 */
export const FilterMenu = ({
  label,
  items,
  comingSoon,
  resetLabel,
  onReset,
  onSelect,
}: IFilterMenuProps) => (
  <>
    <PopoverMenu
      actions={[
        items.map(({ label: itemLabel, icon, panel }) => ({
          label: itemLabel,
          icon,
          panelRole: "menu",
          panel,
        })),
      ]}
      label={label}
      onSelect={onSelect}
    />

    <Typography
      appearance="subdued"
      className="mx-1 flex h-8 items-center px-1.5 italic"
      typographyType="body-sm"
    >
      {comingSoon}
    </Typography>

    {!!onReset && !!resetLabel && <FilterReset label={resetLabel} onReset={onReset} />}
  </>
);
