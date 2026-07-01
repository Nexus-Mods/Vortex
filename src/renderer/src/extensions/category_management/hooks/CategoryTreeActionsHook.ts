import { randomUUID } from "crypto";

import type { IModCategory } from "@nexusmods/nexus-api";
import { useCallback } from "react";
import { useStore } from "react-redux";

import { updateCategories } from "@/actions";
import { log } from "@/logging";
import type { IMod } from "@/types/api";

import type { ICategoriesTreeEntry } from "../types/ICategoriesTreeEntry";
import type { ICategory } from "../types/ICategoryDictionary";
import type { ICategoryDictionary } from "../types/ICategoryDictionary";
import buildCategoryTree from "../util/buildCategoryTree";
import getGameCategories from "../util/getCategoriesFromNexusMods";

interface ICategoryTreeActionsProps {
  categories: ICategoryDictionary;
  modsByCategory: { [categoryId: string]: IMod[] };
  gameId: string;
  onSetCategory: (gameId: string, categoryId: string, category: ICategory) => void;
  onRemoveCategory: (categoryId: string) => void;
  onSetCategoryOrder: (gameId: string, categoryIds: string[]) => void;
  OAuthCredentials?: { token: string };
  isFetching: boolean;
  isFetchError: boolean;
  setIsFetchError: (isError: boolean) => void;
  setFetchError: (err: { title: string; detail: string }) => void;
  setIsFetching: (fetching: boolean) => void;
  domainName: string;
}
export default function useCategoryTreeActions(props: ICategoryTreeActionsProps) {
  const {
    OAuthCredentials,
    categories,
    modsByCategory,
    onSetCategory,
    onRemoveCategory,
    onSetCategoryOrder,
    setIsFetching,
    setFetchError,
    isFetching,
    setIsFetchError,
    gameId,
    domainName,
  } = props;

  const store = useStore();

  const importCategoriesFromNexusMods = useCallback(
    async (replaceAll?: boolean) => {
      if (isFetching) return;
      setIsFetching(true);
      setIsFetchError(false);
      try {
        if (!OAuthCredentials?.token) throw new Error("You must be logged in to use this feature.");
        const apiCategories = await getGameCategories(domainName, OAuthCredentials.token);
        const categoryMap = createDictionaryFromList(apiCategories);
        if (!replaceAll) {
          // Try and preserve existing custom categories.
          const keysToSave = Object.keys(categories).filter(
            (k) => isNaN(Number(k)) || Number(k) > 1000,
          );
          keysToSave.forEach((k) => (categoryMap[k] = categories[k]));
        }
        return store.dispatch(updateCategories(gameId, categoryMap));
      } catch (e: unknown) {
        const err = e as Error;
        setIsFetchError(true);
        setFetchError({
          title: "Failed to fetch categories from Nexus Mods",
          detail: err.message,
        });
      } finally {
        setIsFetching(false);
      }
    },
    [
      OAuthCredentials,
      domainName,
      gameId,
      categories,
      setFetchError,
      setIsFetchError,
      setIsFetching,
      store,
      isFetching,
    ],
  );

  const createCategory = useCallback(
    (name: string, order: number = 0, parentCategory?: string) => {
      const uid = randomUUID();
      onSetCategory(gameId, uid, { name, parentCategory, order });
    },
    [gameId, onSetCategory],
  );

  const removeCategory = useCallback(
    (id: string) => {
      onRemoveCategory(id);
    },
    [onRemoveCategory],
  );

  const sortAlphabetically = useCallback(() => {
    const aToZSortFunc = (a: string, b: string) =>
      categories[a].name.localeCompare(categories[b].name);
    try {
      const newTree: ICategoriesTreeEntry[] = buildCategoryTree(
        categories,
        modsByCategory,
        undefined,
        aToZSortFunc,
      );
      const newOrder = (base: ICategoriesTreeEntry[]): string[] =>
        ([] as string[]).concat(
          ...base.map((node) => [node.categoryId, ...newOrder(node.children)]),
        );

      onSetCategoryOrder(gameId, newOrder(newTree));
    } catch (e: unknown) {
      log("error", "Failed to sort categories", e);
    }
  }, [gameId, categories, modsByCategory, onSetCategoryOrder]);

  const moveCategory = useCallback(
    (sourceId: string, targetId: string, position: "before" | "after" | "inside") => {
      const tree = buildCategoryTree(categories, modsByCategory);

      // find the node in the tree
      const findNode = (
        nodes: ICategoriesTreeEntry[],
        id: string,
      ): ICategoriesTreeEntry | undefined => {
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

      const destinationParent: Pick<ICategoriesTreeEntry, "children" | "categoryId"> =
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
      const flatten = (nodes: ICategoriesTreeEntry[]): string[] =>
        nodes.flatMap((node) => [node.categoryId, ...flatten(node.children)]);

      const newOrder = flatten(tree);

      if (sourceNode.parentId !== categories[sourceId].parentCategory) {
        onSetCategory(gameId, sourceId, {
          name: categories[sourceId].name,
          parentCategory: sourceNode.parentId,
          order: 0,
        });
      }
      onSetCategoryOrder(gameId, newOrder);
    },
    [categories, modsByCategory, gameId, onSetCategory, onSetCategoryOrder],
  );

  return {
    createCategory,
    removeCategory,
    sortAlphabetically,
    moveCategory,
    importCategoriesFromNexusMods,
  };
}

function createDictionaryFromList(list: IModCategory[]): ICategoryDictionary {
  const dict = {};
  let counter = 1;
  list
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((category) => {
      const parent =
        category.parent_category === false ? undefined : category.parent_category.toString();
      dict[String(category.category_id)] = {
        name: category.name,
        parentCategory: parent,
        order: counter,
      };
      counter++;
    });

  return dict;
}
