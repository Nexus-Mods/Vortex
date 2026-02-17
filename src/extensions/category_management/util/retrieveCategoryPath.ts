import type { IState } from "../../../renderer/types/IState";
import { activeGameId } from "../../../renderer/util/selectors";
import { getSafe } from "../../../renderer/util/storeHelper";
import { truthy } from "../../../renderer/util/util";
import type { ICategoryDictionary } from "../types/ICategoryDictionary";

function createCategoryDetailPath(
  categories: ICategoryDictionary,
  category: string,
  categoryPath: string,
  hideTopLevel: boolean,
  visited: Set<string>,
) {
  if (!truthy(categories[category])) {
    return null;
  }

  if (!hideTopLevel || categories[category].parentCategory !== undefined) {
    categoryPath =
      categoryPath === ""
        ? categories[category].name
        : categories[category].name + " --> " + categoryPath;
  }

  visited.add(category);

  if (
    categories[category].parentCategory !== undefined &&
    !visited.has(categories[category].parentCategory)
  ) {
    return createCategoryDetailPath(
      categories,
      categories[category].parentCategory,
      categoryPath,
      hideTopLevel,
      visited,
    );
  } else {
    return categoryPath;
  }
}

/**
 * retrieve the Category from the Store returning the full category path.
 *
 * @param {number} category
 * @param {Redux.Store<any>} store
 */
export function resolveCategoryPath(category: string | number, state: IState) {
  if (!truthy(category)) {
    return null;
  }

  // Handle cases where category might be an array converted to string (e.g., "95,1704")
  // or a number - normalize to the first/primary category ID as a string
  let categoryId: string;
  if (typeof category === "number") {
    categoryId = category.toString();
  } else {
    categoryId = category.toString().split(",")[0];
  }

  let completePath: string = "";
  const gameId: string = activeGameId(state);

  const categories: ICategoryDictionary = getSafe(
    state,
    ["persistent", "categories", gameId],
    {},
  );
  const hideTopLevel: boolean = getSafe(
    state,
    ["settings", "interface", "hideTopLevelCategory"],
    false,
  );
  if (categories[categoryId] !== undefined) {
    completePath = createCategoryDetailPath(
      categories,
      categoryId,
      "",
      hideTopLevel,
      new Set<string>(),
    );
  }
  return completePath;
}

export function resolveCategoryId(name: string, state: IState): number {
  const gameId: string = activeGameId(state);

  const categories = state.persistent.categories[gameId];
  const key = Object.keys(categories ?? {}).find(
    (iter) => categories[iter].name === name,
  );
  if (key !== undefined) {
    return parseInt(key, 10);
  } else {
    return undefined;
  }
}

/**
 * retrieve the Category from the Store
 *
 * @param {number} category
 * @param {Redux.Store<any>} store
 */
export function resolveCategoryName(category: string | number, state: IState) {
  if (!truthy(category)) {
    return "";
  }

  // Handle cases where category might be an array converted to string (e.g., "95,1704")
  // or a number - normalize to the first/primary category ID as a string
  let categoryId: string;
  if (typeof category === "number") {
    categoryId = category.toString();
  } else {
    categoryId = category.toString().split(",")[0];
  }

  const gameId: string = activeGameId(state);

  return getSafe(
    state,
    ["persistent", "categories", gameId, categoryId, "name"],
    "",
  );
}
