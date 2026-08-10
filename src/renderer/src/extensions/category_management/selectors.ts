import type { IState } from "@/types/api";

import { activeGameId } from "../../util/selectors";
import type { ICategoryDictionary } from "./types/ICategoryDictionary";

export function allCategories(state: IState): ICategoryDictionary {
  const gameMode = activeGameId(state);
  return state.persistent.categories[gameMode] ?? {};
}
