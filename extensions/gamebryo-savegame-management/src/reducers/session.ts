import { types, util } from "@nexusmods/vortex-api";
import update from "immutability-helper";

import * as actions from "../actions/session";
import type { ISavegame } from "../types/ISavegame";
import type { IStateSavegame } from "../types/IStateSavegame";

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: types.IReducerSpec<IStateSavegame> = {
  reducers: {
    [actions.setSavegames as any]: (
      state: IStateSavegame,
      payload: { savegames: { [id: string]: ISavegame }; truncated: boolean },
    ) => {
      const { savegames, truncated } = payload;
      return util.setSafe(util.setSafe(state, ["saves"], savegames), ["savesTruncated"], truncated);
    },
    [actions.removeSavegame as any]: (state: IStateSavegame, payload: string) =>
      util.deleteOrNop(state, ["saves", payload]),
    [actions.setSavegameAttribute as any]: (
      state: IStateSavegame,
      payload: { id: string; attribute: string; value: any },
    ) => {
      const { id, attribute, value } = payload;
      return update(state, {
        saves: { [id]: { attributes: { [attribute]: { $set: value } } } },
      });
    },
    [actions.updateSavegame as any]: (
      state: IStateSavegame,
      payload: { id: string; saveGame: ISavegame },
    ) => {
      const { id, saveGame } = payload;
      return util.setSafe(state, ["saves", id], saveGame);
    },
    [actions.showTransferDialog as any]: (state: IStateSavegame, payload: boolean) =>
      util.setSafe(state, ["showDialog"], payload),
    [actions.clearSavegames as any]: (state: IStateSavegame, payload) =>
      update(state, { saves: { $set: {} } }),
    [actions.setSavegamePath as any]: (state: IStateSavegame, payload: string) =>
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
