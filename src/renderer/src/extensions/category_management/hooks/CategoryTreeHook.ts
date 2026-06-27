import { randomUUID } from "crypto";

import {
  mdiCollapseAll,
  mdiExpandAll,
  mdiEye,
  mdiEyeOff,
  mdiFolderPlus,
  mdiSortAlphabeticalAscending,
  mdiSync,
} from "@mdi/js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { log } from "@/logging";
import type { IState } from "@/types/api";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { activeGameId } from "@/util/selectors";

import type { ICategoriesTree } from "../types/ITrees";
import createTreeDataObject from "../util/createTreeDataObject";
import useCategoriesFromNexusMods from "./CategoriesFromNexusMods";
import useCategoryList from "./CategoryListHook";

export default function useCategoryTree() {
  const didOpenRootCategoriesRef = useRef<boolean>(false);
  const [addParentVisible, setAddParentVisible] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set<string>());
  const [showEmpty, setShowEmpty] = useState(true);
  const [searchString, setSearchString] = useState<string>("");
  const [newParentCategoryName, setNewParentCategoryName] = useState("");

  const { t } = useTranslation("common");
  const { categories, mods, gameMode } = useSelector((state: IState) => {
    const gameMode = activeGameId(state);
    return {
      gameMode,
      mods: state.persistent.mods[gameMode],
      categories: state.persistent.categories?.[gameMode] || {},
    };
  });

  const {
    isError,
    isLoading,
    fetchCategoriesForGame,
    error: fetchError,
    clearError,
  } = useCategoriesFromNexusMods();
  const { onSetCategoryOrder, onSetCategory, onRemoveCategory } = useCategoryList();

  const startCreateParentCategory = (show: boolean = true) => {
    if (!show) setNewParentCategoryName("");
    setAddParentVisible(show);
  };

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
    const aToZSortFunc = (a: string, b: string) =>
      categories[a].name.localeCompare(categories[b].name);
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

  const moveCategory = useCallback(
    (sourceId: string, targetId: string, position: "before" | "after" | "inside") => {
      console.log("moveCategory called", { sourceId, targetId, position });
      const tree = createTreeDataObject(t, categories, mods);

      // find the node in the tree
      const findNode = (nodes: ICategoriesTree[], id: string): ICategoriesTree | undefined => {
        for (const node of nodes) {
          if (node.categoryId === id) return node;
          const child = findNode(node.children, id);
          if (child) return child;
        }
      };

      const sourceNode = findNode(tree, sourceId);
      const sourceParent = findNode(tree, sourceNode?.parentId);
      const targetNode = findNode(tree, targetId);
      if (!sourceNode || !targetNode) return;

      // Remove the source from it's current list
      if (sourceParent) {
        sourceParent.children = sourceParent.children.filter((c) => c.categoryId !== sourceId);
      } else {
        tree.splice(
          tree.findIndex((c) => c.categoryId === sourceId),
          1,
        );
      }

      const destinationParent: Pick<ICategoriesTree, "children" | "categoryId"> =
        position === "inside"
          ? targetNode
          : findNode(tree, targetNode.parentId) || { children: tree, categoryId: undefined };
      const targetIndex = destinationParent.children.findIndex((c) => c.categoryId === targetId);

      const insertIndex =
        position === "before"
          ? targetIndex
          : position === "after"
            ? targetIndex + 1
            : destinationParent.children.length;

      destinationParent.children.splice(insertIndex, 0, sourceNode);

      if (position === "inside") {
        sourceNode.parentId = targetNode.categoryId;
      } else {
        sourceNode.parentId = destinationParent?.categoryId;
      }

      // Flatten the treee
      const flatten = (nodes: ICategoriesTree[]): string[] =>
        nodes.flatMap((node) => [node.categoryId, ...flatten(node.children)]);

      const newOrder = flatten(tree);

      if (sourceNode.parentId !== categories[sourceId].parentCategory) {
        onSetCategory(gameMode, sourceId, {
          name: categories[sourceId].name,
          parentCategory: sourceNode.parentId,
          order: 0,
        });
      }
      onSetCategoryOrder(gameMode, newOrder);
    },
    [t, categories, mods, gameMode, onSetCategory, onSetCategoryOrder],
  );
  const toolbarActions: IToolbarAction[] = useMemo(
    () => [
      {
        label: expanded.size === 0 ? "Expand All" : "Collapse All",
        iconPath: expanded.size === 0 ? mdiExpandAll : mdiCollapseAll,
        showLabel: true,
        onClick: () => (expanded.size === 0 ? expandAll() : collapseAll()),
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
          void fetchCategoriesForGame(false);
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
      fetchCategoriesForGame,
      addParentVisible,
    ],
  );

  const createCategory = useCallback(
    (name: string, order: number = 0, parentCategory?: string) => {
      const uid = randomUUID();
      onSetCategory(gameMode, uid, { name, parentCategory, order });
    },
    [gameMode, onSetCategory],
  );

  const removeCategory = useCallback(
    (id: string) => {
      onRemoveCategory(gameMode, id);
    },
    [gameMode, onRemoveCategory],
  );

  useEffect(() => {
    if (!didOpenRootCategoriesRef.current && treeData.length > 0) {
      const topLevel = treeData.filter((c) => !c.parentId);
      setExpanded(new Set(topLevel.map((node) => node.categoryId))); // eslint-disable-line @eslint-react/set-state-in-effect
      didOpenRootCategoriesRef.current = true;
    }
  }, [treeData]);

  return {
    searchString,
    setSearchString,
    toolbarActions,
    filteredTreeData,
    toggleExpand,
    createCategory,
    removeCategory,
    moveCategory,
    fetchError,
    isError,
    isLoading,
    fetchCategoriesForGame,
    addParentVisible,
    startCreateParentCategory,
    newParentCategoryName,
    setNewParentCategoryName,
    clearError,
  };
}
