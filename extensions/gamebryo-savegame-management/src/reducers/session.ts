import { types, util } from "@nexusmods/vortex-api";
import update from "immutability-helper";

import * as actions from "../actions/session";
import type { IStateSavegame } from "../types/IStateSavegame";

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: types.IReducerSpec<IStateSavegame> = util.actionsToReducerSpec<
  IStateSavegame,
  typeof actions
>(
  {
    saves: {},
    savesTruncated: false,
    savegamePath: "",
    showDialog: false,
    selectedProfile: undefined,
  },
  actions,
  {
    setSavegames: (state, payload) => {
      const { savegames, truncated } = payload;
      return util.setSafe(util.setSafe(state, ["saves"], savegames), ["savesTruncated"], truncated);
    },
    removeSavegame: (state, payload) => util.deleteOrNop(state, ["saves", payload]),
    setSavegameAttribute: (state, payload) => {
      const { id, attribute, value } = payload;
      return update(state, {
        saves: { [id]: { attributes: { [attribute]: { $set: value } } } },
      });
    },
    updateSavegame: (state, payload) => {
      const { id, saveGame } = payload;
      return util.setSafe(state, ["saves", id], saveGame);
    },
    showTransferDialog: (state, payload) => util.setSafe(state, ["showDialog"], payload),
    clearSavegames: (state) => update(state, { saves: { $set: {} } }),
    setSavegamePath: (state, payload) => util.setSafe(state, ["savegamePath"], payload),
  },
);
