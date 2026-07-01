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

import type { ICategoriesTreeEntry } from "../types/ICategoriesTreeEntry";

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
  } = props;

  const toolbarActions: IToolbarAction[] = useMemo(
    () => [
      {
        label: expanded.size === 0 ? "Expand All" : "Collapse All",
        iconPath: expanded.size === 0 ? mdiExpandAll : mdiCollapseAll,
        showLabel: true,
        onClick: () =>
          expanded.size === 0 ? expandAll(treeData.flatMap((t) => t.categoryId)) : collapseAll(),
      },
      {
        label: showEmpty ? "Hide Empty" : "Show Empty",
        iconPath: showEmpty ? mdiEyeOff : mdiEye,
        showLabel: true,
        onClick: toggleEmpty,
      },
      {
        label: "Add Top Level",
        iconPath: mdiFolderPlus,
        onClick: () => setAddParentVisible(!addParentVisible),
      },
      {
        label: "Sort A-Z",
        iconPath: mdiSortAlphabeticalAscending,
        onClick: sortAlphabetically,
      },
      {
        label: "Fetch from Nexus Mods",
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
    ],
  );
  return toolbarActions;
}
