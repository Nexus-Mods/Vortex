import type { IReducerSpec } from "../../../types/IExtensionContext";
import { setSafe } from "../../../util/storeHelper";
import * as actions from "../actions/session";

const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.startEditCollection as any]: (state, payload) => {
      const { modId } = payload;
      return setSafe(state, ["editCollectionId"], modId);
    },
    [actions.startAddModsToCollection as any]: (state, payload) => {
      const { collectionId } = payload;
      return setSafe(state, ["addModsId"], collectionId);
    },
    [actions.healthDownvoteDialog as any]: (state, payload) => {
      const { collectionModId } = payload;
      return setSafe(state, ["healthDownvoteDialog"], collectionModId);
    },
  },
  defaults: {
    editCollectionId: undefined,
    addModsId: undefined,
    healthDownvoteDialog: undefined,
  },
};

export default sessionReducer;
