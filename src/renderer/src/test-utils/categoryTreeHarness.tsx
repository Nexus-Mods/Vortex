/**
 * Harness for the category-management tree hooks: renders useCategoryTreeActions
 * against a minimal redux store running the category reducer, with the hook's
 * callbacks dispatching the same typed actions CategoryTreeSelectionHook
 * dispatches in production. No Electron, persistence, or extension registration.
 *
 * getVisibleIds rebuilds the tree from current state: buildCategoryTree walks
 * parentCategory links down from the roots, so a category whose parent chain is
 * broken (cycle, dangling parent) stays in state but can never be displayed.
 */
import { render } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import { createReducer } from "redux-act";

import {
  removeCategory,
  setCategory,
  setCategoryOrder,
  updateCategories,
} from "../extensions/category_management/actions/category";
import useCategoryTreeActions from "../extensions/category_management/hooks/CategoryTreeActionsHook";
import { categoryReducer } from "../extensions/category_management/reducers/category";
import type {
  ICategoryDictionary,
  ICategoryState,
} from "../extensions/category_management/types/ICategoryDictionary";
import buildCategoryTree from "../extensions/category_management/util/buildCategoryTree";
import { flattenTreeToIDs } from "../extensions/category_management/util/flattenCategoryTree";

export interface ICategoryTreeActionsHarness {
  /** the rendered hook's live return value */
  actions: () => ReturnType<typeof useCategoryTreeActions>;
  /** the categories slice for the harness game, read from the real store */
  getCategories: () => ICategoryDictionary;
  /** the ids a tree rebuilt from current state can actually display */
  getVisibleIds: () => string[];
}

export const HARNESS_GAME_ID = "skyrimse";

export function makeCategoryTreeActionsHarness(
  categories: ICategoryDictionary,
): ICategoryTreeActionsHarness {
  const store = createStore(
    createReducer<ICategoryState>(categoryReducer.reducers, categoryReducer.defaults),
  );
  store.dispatch(updateCategories(HARNESS_GAME_ID, categories));

  // @testing-library/react 12 has no renderHook; a headless probe component
  // runs the hook and hands its return value out
  const result: { current: ReturnType<typeof useCategoryTreeActions> | undefined } = {
    current: undefined,
  };
  const Probe = () => {
    result.current = useCategoryTreeActions({
      categories,
      modsByCategory: {},
      gameId: HARNESS_GAME_ID,
      domainName: HARNESS_GAME_ID,
      onSetCategory: (gameId, categoryId, category) =>
        store.dispatch(setCategory(gameId, categoryId, category)),
      onRemoveCategory: (categoryId) => store.dispatch(removeCategory(HARNESS_GAME_ID, categoryId)),
      onSetCategoryOrder: (gameId, categoryIds) =>
        store.dispatch(setCategoryOrder(gameId, categoryIds)),
      isFetching: false,
      isFetchError: false,
      setIsFetchError: () => undefined,
      setFetchError: () => undefined,
      setIsFetching: () => undefined,
      t: (k: string) => k,
    });
    return null;
  };

  render(
    <Provider store={store}>
      <Probe />
    </Provider>,
  );

  const getCategories = () => store.getState()[HARNESS_GAME_ID];

  return {
    // the Probe render above runs synchronously, so current is always assigned
    actions: () => result.current,
    getCategories,
    getVisibleIds: () => flattenTreeToIDs(buildCategoryTree(getCategories(), {})),
  };
}
