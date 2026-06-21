import {
  mdiCollapseAll,
  mdiExpandAll,
  mdiEye,
  mdiEyeOff,
  mdiFolderPlus,
  mdiSortAlphabeticalAscending,
  mdiSync,
} from "@mdi/js";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { log } from "@/logging";
import type { IState } from "@/types/api";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { activeGameId } from "@/util/selectors";

import type { ICategoriesTree } from "../types/ITrees";
import createTreeDataObject from "../util/createTreeDataObject";
import useCategoryList from "./CategoryListHook";

export default function useCategoryTree() {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set<string>());
  const [showEmpty, setShowEmpty] = useState(true);
  // const [searchFocusIndex, setSearchFocusIndex] = useState(0);
  // const [searchFoundCount, setSearchFoundCount] = useState(0);
  const [searchString, setSearchString] = useState<string>("");

  const { t } = useTranslation("common");
  const { categories, mods, gameMode } = useSelector((state: IState) => {
    const gameMode = activeGameId(state);
    return {
      gameMode,
      mods: state.persistent.mods[gameMode],
      categories: state.persistent.categories?.[gameMode] || {},
    };
  });

  const { onSetCategoryOrder, onRemoveCategory } = useCategoryList();

  const treeData = useMemo(() => {
    if (!categories || !Object.keys(categories).length) return [];
    return createTreeDataObject(t, categories, mods);
  }, [categories, mods, t]);

  const nonEmptyCategories = useMemo(() => {
    const result = new Set<string>();

    const markNonEmpty = (node: ICategoriesTree): boolean => {
      let hasMods = node.modCount > 0;

      for (const child of node.children) {
        if (markNonEmpty(child)) {
          hasMods = true;
        }
      }

      if (hasMods) {
        result.add(node.categoryId);
      }

      return hasMods;
    };

    treeData.forEach(markNonEmpty);

    return result;
  }, [treeData]);

  const toggleExpand = useCallback((categoryId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }, []);

  const expandedTreeData = useMemo(() => {
    const applyExpand = (categoryTree: ICategoriesTree[]): ICategoriesTree[] => {
      const filtered = showEmpty
        ? new Set(categoryTree.map((obj) => obj.categoryId))
        : nonEmptyCategories;

      return categoryTree
        .map((obj) => {
          if (!filtered.has(obj.categoryId)) return undefined;
          const copy = { ...obj };
          copy.expanded = expanded.has(copy.categoryId);
          copy.children = applyExpand(copy.children);
          return copy;
        })
        .filter(Boolean);
    };

    return applyExpand(treeData);
  }, [treeData, showEmpty, expanded, nonEmptyCategories]);

  const expandAll = useCallback(() => {
    setExpanded(new Set<string>(treeData.map((c) => c.categoryId)));
  }, [treeData]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set<string>());
  }, []);

  const toggleEmpty = useCallback(() => {
    setShowEmpty((prev) => !prev);
  }, []);

  const filteredTreeData = useMemo(() => {
    if (!searchString?.trim()) return expandedTreeData;

    const query = searchString.toLowerCase();

    const filterTree = (nodes: ICategoriesTree[]): ICategoriesTree[] => {
      return nodes
        .map((node) => {
          const matches =
            node.title.toLowerCase().includes(query) || node.subtitle.toLowerCase().includes(query);

          const children = filterTree(node.children);

          if (matches || children.length > 0) {
            return { ...node, children };
          }

          return undefined;
        })
        .filter((node): node is ICategoriesTree => !!node);
    };

    return filterTree(expandedTreeData);
  }, [expandedTreeData, searchString]);

  const sortAlphabetically = useCallback(() => {
    const aToZSortFunc = (a, b) => categories[a].name.localeCompare(categories[b].name);
    try {
      const newTree: ICategoriesTree[] = createTreeDataObject(t, categories, mods, aToZSortFunc);
      const newOrder = (base: ICategoriesTree[]): string[] =>
        ([] as string[]).concat(
          ...base.map((node) => [node.categoryId, ...newOrder(node.children)]),
        );

      onSetCategoryOrder(gameMode, newOrder(newTree));
    } catch (e: unknown) {
      log("error", "Failed to sort categories", e);
    }
  }, [gameMode, categories, mods, onSetCategoryOrder, t]);

  const toolbarActions: IToolbarAction[] = useMemo(
    () => [
      {
        label: "Expand All",
        iconPath: mdiExpandAll,
        showLabel: true,
        onClick: expandAll,
      },
      {
        label: "Collapse All",
        onClick: collapseAll,
        iconPath: mdiCollapseAll,
        showLabel: true,
      },
      {
        label: "Add Top Level",
        iconPath: mdiFolderPlus,
      },
      {
        label: "Show/Hide Empty",
        title: "Show/Hide Empty",
        iconPath: showEmpty ? mdiEye : mdiEyeOff,
        onClick: toggleEmpty,
      },
      {
        label: "Sort A-Z",
        iconPath: mdiSortAlphabeticalAscending,
        onClick: sortAlphabetically,
      },
      {
        label: "Fetch from Nexus Mods",
        iconPath: mdiSync,
      },
    ],
    [showEmpty, toggleEmpty, collapseAll, expandAll, sortAlphabetically],
  );

  const removeCategory = useCallback(
    (id: string) => {
      onRemoveCategory(gameMode, id);
    },
    [gameMode, onRemoveCategory],
  );

  return {
    searchString,
    setSearchString,
    toolbarActions,
    filteredTreeData,
    toggleExpand,
    removeCategory,
  };
}
