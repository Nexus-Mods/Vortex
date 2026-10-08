import { types } from "@nexusmods/vortex-api";

import { GAME_ID } from "./common";

export const autoSortLoadOrderEnabled = (state: types.IState): boolean =>
  state.settings[GAME_ID]?.autoSortLoadOrder ?? false;
