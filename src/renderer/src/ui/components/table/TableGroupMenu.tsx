import type { TFunction } from "i18next";

import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";

/** What a built-in item's click reports: the state it moves the group, or its rows, to. */
const reporting = (properties: { expanded: boolean } | { selected: boolean }) => ({
  trackingProperties: properties,
});

interface ITableGroupMenuSectionsOptions {
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
  /** Translates the labels. */
  t: TFunction;
}

/**
 * A group's built-in menu sections: folding it, or every group, then selecting its rows. Empty
 * sections are left out. Each item keeps its id whichever way its label reads (`collapse`,
 * `collapse-all`, `select-all`), and says in `trackingProperties` the state it moves to:
 * `expanded` for folding, `selected` for selecting.
 */
export const tableGroupMenuSections = ({
  expanded,
  onToggle,
  onSetAllExpanded,
  allSelected = false,
  onSelectAll,
  onDeselectAll,
  t,
}: ITableGroupMenuSectionsOptions): IToolbarAction[][] => {
  const folding: IToolbarAction[] = [
    {
      id: "collapse",
      ...reporting({ expanded: !expanded }),
      label: expanded ? t("Collapse") : t("Expand"),
      icon: expanded ? "unfold_less" : "unfold_more",
      onClick: onToggle,
    },
    {
      id: "collapse-all",
      ...reporting({ expanded: !expanded }),
      label: expanded ? t("Collapse all") : t("Expand all"),
      icon: expanded ? "unfold_less" : "unfold_more",
      onClick: () => onSetAllExpanded(!expanded),
    },
  ];

  const selecting: IToolbarAction[] = [];
  if (allSelected && onDeselectAll) {
    selecting.push({
      id: "select-all",
      ...reporting({ selected: false }),
      label: t("Deselect all in group"),
      icon: "check_box_outline_blank",
      onClick: onDeselectAll,
    });
  } else if (onSelectAll) {
    selecting.push({
      id: "select-all",
      ...reporting({ selected: true }),
      label: t("Select all in group"),
      icon: "check_box",
      onClick: onSelectAll,
    });
  }

  return [folding, selecting].filter((section) => section.length > 0);
};

/**
 * The built-in sections as toolbar actions, for the heading's toolbar menus: a `section` each,
 * so a rule divides them. The heading's toolbar counts their clicks by id.
 */
export const tableGroupMenuActions = (
  options: ITableGroupMenuSectionsOptions,
): IToolbarAction[] => {
  const [folding, selecting = []] = tableGroupMenuSections(options);

  return [
    ...folding.map((action): IToolbarAction => ({ ...action, section: "folding" })),
    ...selecting.map((action): IToolbarAction => ({ ...action, section: "selecting" })),
  ];
};
