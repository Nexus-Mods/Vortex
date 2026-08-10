import { useEffect, useMemo, useRef } from "react";

import type { IMod } from "@/types/api";

import type { ICategoriesTreeEntry } from "../types/ICategoriesTreeEntry";
import type { ICategoryDictionary } from "../types/ICategoryDictionary";
import buildCategoryTree from "../util/buildCategoryTree";

interface ICategoryTreeDataProps {
  categories: ICategoryDictionary;
  modsbyCategory: { [categoryId: string]: IMod[] };
  expanded: Set<string>;
  showEmpty: boolean;
  searchString: string;
  setExpanded: (categories: Set<string>) => void;
}

export default function useCategoryTreeData(props: ICategoryTreeDataProps) {
  const { categories, modsbyCategory, expanded, showEmpty, searchString, setExpanded } = props;
  const didOpenRootCategoriesRef = useRef<boolean>(false);

  const treeData = useMemo(() => {
    if (!categories || !Object.keys(categories).length) return [];
    return buildCategoryTree(categories, modsbyCategory);
  }, [categories, modsbyCategory]);

  const nonEmptyCategories = useMemo(() => {
    const result = new Set<string>();

    const markNonEmpty = (node: ICategoriesTreeEntry): boolean => {
      let hasMods = node.nestedModCount > 0;

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

  const expandedTreeData = useMemo(() => {
    const applyExpand = (categoryTree: ICategoriesTreeEntry[]): ICategoriesTreeEntry[] => {
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

  const filteredTreeData = useMemo(() => {
    if (!searchString?.trim()) return expandedTreeData;

    const query = searchString.toLowerCase();

    const filterTree = (nodes: ICategoriesTreeEntry[]): ICategoriesTreeEntry[] => {
      return nodes
        .map((node) => {
          const matches = node.title.toLowerCase().includes(query);

          const children = filterTree(node.children);

          if (matches || children.length > 0) {
            return { ...node, children };
          }

          return undefined;
        })
        .filter((node): node is ICategoriesTreeEntry => !!node);
    };

    return filterTree(expandedTreeData);
  }, [expandedTreeData, searchString]);

  useEffect(() => {
    if (!didOpenRootCategoriesRef.current && treeData.length > 0) {
      const topLevel = treeData.filter((c) => !c.parentId);
      setExpanded(new Set(topLevel.map((node) => node.categoryId)));
      didOpenRootCategoriesRef.current = true;
    }
  }, [treeData, setExpanded]);

  return {
    treeData,
    nonEmptyCategories,
    expandedTreeData,
    filteredTreeData,
  };
}
