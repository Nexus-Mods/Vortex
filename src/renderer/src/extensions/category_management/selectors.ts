import type { IState } from "@/types/api";

import { activeGameId } from "../../util/selectors";
import type { ICategoryDictionary } from "./types/ICategoryDictionary";

// One shared empty dictionary, so selectors built on `allCategories` keep a stable
// input (and output) for a game with no categories.
const NO_CATEGORIES: ICategoryDictionary = Object.freeze({}) as ICategoryDictionary;

export function allCategories(state: IState): ICategoryDictionary {
  const gameMode = activeGameId(state);
  return state.persistent.categories[gameMode] ?? NO_CATEGORIES;
}
