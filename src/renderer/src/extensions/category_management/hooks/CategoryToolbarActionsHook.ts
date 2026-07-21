import {
  mdiCollapseAll,
  mdiExpandAll,
  mdiEye,
  mdiEyeOff,
  mdiFolderPlus,
  mdiSortAlphabeticalAscending,
  mdiSync,
} from "@mdi/js";
import { useMemo } from "react";

import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import type { TFunction } from "@/util/i18n";

import type { ICategoriesTreeEntry } from "../types/ICategoriesTreeEntry";
import { flattenTreeToIDs } from "../util/flattenCategoryTree";

interface ICategoryToolbarActionsProps {
  expanded: Set<string>;
  showEmpty: boolean;
  treeData: ICategoriesTreeEntry[];
  expandAll: (ids: string[]) => void;
  collapseAll: () => void;
  addParentVisible: boolean;
  setAddParentVisible: (show?: boolean) => void;
  toggleEmpty: () => void;
  sortAlphabetically: () => void;
  importCategoriesFromNexusMods: (replace?: boolean) => void;
  t: TFunction;
}

export default function useCategoryToolbarActions(props: ICategoryToolbarActionsProps) {
  const {
    addParentVisible,
    setAddParentVisible,
    expanded,
    showEmpty,
    treeData,
    expandAll,
    collapseAll,
    toggleEmpty,
    sortAlphabetically,
    importCategoriesFromNexusMods,
    t,
  } = props;

  const toolbarActions: IToolbarAction[] = useMemo(
    () => [
      {
        label: expanded.size === 0 ? t("Expand All") : t("Collapse All"),
        iconPath: expanded.size === 0 ? mdiExpandAll : mdiCollapseAll,
        showLabel: true,
        onClick: () =>
          expanded.size === 0 ? expandAll(flattenTreeToIDs(treeData)) : collapseAll(),
      },
      {
        label: showEmpty ? t("Hide Empty") : t("Show Empty"),
        iconPath: showEmpty ? mdiEyeOff : mdiEye,
        showLabel: true,
        onClick: toggleEmpty,
      },
      {
        label: t("Add Top Level"),
        iconPath: mdiFolderPlus,
        onClick: () => setAddParentVisible(!addParentVisible),
      },
      {
        label: t("Sort A-Z"),
        iconPath: mdiSortAlphabeticalAscending,
        onClick: sortAlphabetically,
      },
      {
        label: t("Fetch from Nexus Mods"),
        iconPath: mdiSync,
        onClick: () => {
          void importCategoriesFromNexusMods(false);
        },
      },
    ],
    [
      showEmpty,
      toggleEmpty,
      collapseAll,
      expandAll,
      sortAlphabetically,
      expanded,
      importCategoriesFromNexusMods,
      addParentVisible,
      setAddParentVisible,
      treeData,
      t,
    ],
  );
  return toolbarActions;
}
