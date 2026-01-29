import { types, util } from "vortex-api";

import * as actions from "../actions/session";

const sessionReducer: types.IReducerSpec = {
  reducers: {
    [actions.startEditCollection as any]: (state, payload) => {
      const { modId } = payload;
      return util.setSafe(state, ["editCollectionId"], modId);
    },
    [actions.startAddModsToCollection as any]: (state, payload) => {
      const { collectionId } = payload;
      return util.setSafe(state, ["addModsId"], collectionId);
    },
    [actions.healthDownvoteDialog as any]: (state, payload) => {
      const { collectionModId } = payload;
      return util.setSafe(state, ["healthDownvoteDialog"], collectionModId);
    },
  },
  defaults: {
    editCollectionId: undefined,
    addModsId: undefined,
    healthDownvoteDialog: undefined,
  },
};

export default sessionReducer;
