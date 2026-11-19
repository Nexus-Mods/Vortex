import React from "react";
import { useTranslation } from "react-i18next";

import { FilterReset } from "@/ui/components/filters/FilterReset";
import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";

import {
  MODS_TABLE_STATUSES,
  type ModsTableStatus,
} from "../../util/mods_table_filters/modsTableFilters";

interface IModsTableStatusMenuProps {
  /** The statuses ticked. */
  status: ModsTableStatus[];
  /** Takes the statuses ticked after one's toggled. */
  onChange: (status: ModsTableStatus[]) => void;
  /** Puts Status back as the view has it; unset, there's no reset. */
  onReset?: () => void;
  /** Goes back to the menu this one opened from, for a submenu. */
  onClose?: () => void;
  /** Dismisses the menu. */
  onSelect: () => void;
}

/**
 * The Status filter's choices, any of them ticked, each toggling without closing the menu; with a
 * reset while it differs from the view's own.
 */
export const ModsTableStatusMenu = ({
  status,
  onChange,
  onReset,
  onClose,
  onSelect,
}: IModsTableStatusMenuProps) => {
  const { t } = useTranslation("mod_management");

  return (
    <>
      <PopoverMenu
        actions={[
          MODS_TABLE_STATUSES.map((value) => ({
            label: t(`modsTable::filters::${value}`),
            selected: status.includes(value),
            onClick: () =>
              onChange(
                status.includes(value)
                  ? status.filter((ticked) => ticked !== value)
                  : MODS_TABLE_STATUSES.filter((each) => each === value || status.includes(each)),
              ),
          })),
        ]}
        label={t("modsTable::filters::status")}
        onClose={onClose}
        onSelect={onSelect}
      />

      {!!onReset && <FilterReset label={t("modsTable::filters::resetStatus")} onReset={onReset} />}
    </>
  );
};
