import {
  mdiCheckboxBlankOutline,
  mdiCheckboxMarkedOutline,
  mdiUnfoldLessHorizontal,
  mdiUnfoldMoreHorizontal,
} from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { PopoverMenu } from "@/ui/components/popover/popover_menu/PopoverMenu";
import type { IMenuAction } from "@/ui/components/popover/popover_menu/PopoverMenu.types";

interface ITableGroupMenuProps {
  /** The group's name, which names the menu. */
  label: string;
  /** Whether the group is open, which offers to collapse it, or to expand it. */
  expanded: boolean;
  /** Collapses the group, or expands it. */
  onToggle: () => void;
  /** Collapses every group, or expands every one. */
  onSetAllExpanded: (expanded: boolean) => void;
  /** Whether every row in the group is selected, which offers to deselect them instead. */
  allSelected?: boolean;
  /** Adds the group's rows to the selection; unset where rows can't be selected. */
  onSelectAll?: () => void;
  /** Takes the group's rows out of the selection. */
  onDeselectAll?: () => void;
  /** Closes the menu, once a row is chosen. */
  onSelect: () => void;
}

/**
 * A group row's context menu: collapse or expand it, or every group, and select its rows, or
 * deselect them once they all are.
 */
export const TableGroupMenu = ({
  label,
  expanded,
  onToggle,
  onSetAllExpanded,
  allSelected = false,
  onSelectAll,
  onDeselectAll,
  onSelect,
}: ITableGroupMenuProps) => {
  const { t } = useTranslation();

  const folding: IMenuAction[] = [
    {
      label: expanded ? t("Collapse") : t("Expand"),
      iconPath: expanded ? mdiUnfoldLessHorizontal : mdiUnfoldMoreHorizontal,
      onClick: onToggle,
    },
    {
      label: expanded ? t("Collapse all") : t("Expand all"),
      onClick: () => onSetAllExpanded(!expanded),
    },
  ];

  const selecting: IMenuAction[] = [];
  if (allSelected && onDeselectAll !== undefined) {
    selecting.push({
      label: t("Deselect all in group"),
      iconPath: mdiCheckboxBlankOutline,
      onClick: onDeselectAll,
    });
  } else if (onSelectAll !== undefined) {
    selecting.push({
      label: t("Select all in group"),
      iconPath: mdiCheckboxMarkedOutline,
      onClick: onSelectAll,
    });
  }

  return (
    <PopoverMenu
      actions={[folding, selecting].filter((section) => section.length > 0)}
      label={t("{{name}} group actions", { name: label })}
      onSelect={onSelect}
    />
  );
};
