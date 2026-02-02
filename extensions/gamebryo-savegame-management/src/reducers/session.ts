import { types, util } from "vortex-api";

import * as actions from "../actions/session";

import update from "immutability-helper";

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.setSavegames as any]: (state, payload) => {
      const { savegames, truncated } = payload;
      return util.setSafe(
        util.setSafe(state, ["saves"], savegames),
        ["savesTruncated"],
        truncated,
      );
    },
    [actions.removeSavegame as any]: (state, payload) =>
      util.deleteOrNop(state, ["saves", payload]),
    [actions.setSavegameAttribute as any]: (state, payload) => {
      const { id, attribute, value } = payload;
      return update(state, {
        saves: { [id]: { attributes: { [attribute]: { $set: value } } } },
      });
    },
    [actions.updateSavegame as any]: (state, payload) => {
      const { id, saveGame } = payload;
      return util.setSafe(state, ["saves", id], saveGame);
    },
    [actions.showTransferDialog as any]: (state, payload) =>
      util.setSafe(state, ["showDialog"], payload),
    [actions.clearSavegames as any]: (state, payload) =>
      update(state, { saves: { $set: {} } }),
    [actions.setSavegamePath as any]: (state, payload) =>
      util.setSafe(state, ["savegamePath"], payload),
  },
  defaults: {
    saves: {},
    savesTruncated: false,
    savegamePath: "",
    showDialog: false,
    selectedProfile: undefined,
  },
};
