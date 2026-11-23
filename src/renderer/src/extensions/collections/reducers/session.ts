import { actionsToPartialReducerSpec } from "../../../reducers/builder";
import type { ICollectionInstallState } from "../../../types/collections/ICollectionInstallSession";
import * as actions from "../actions/session";

declare module "@/types/collections/ICollectionInstallSession" {
  // session.collections is shared with the collection install tracking reducer
  // (reducers/collectionInstallTracking.ts); these are the fields this extension's reducer owns
  interface ICollectionInstallState {
    /** id of the collection mod being edited in the workshop, if any */
    editCollectionId?: string;
    /** id of the collection the "add mods" dialog is open for, if any */
    addModsId?: string;
    /** id of the collection mod the health downvote dialog is open for, if any */
    healthDownvoteDialog?: string;
  }
}

/**
 * reducer for the collections extension's part of session.collections. Partial: the rest of the
 * slice belongs to the collection install tracking reducer registered at the same path.
 */
const sessionReducer = actionsToPartialReducerSpec<ICollectionInstallState, typeof actions>(
  {
    editCollectionId: undefined,
    addModsId: undefined,
    healthDownvoteDialog: undefined,
  },
  actions,
  {
    startEditCollection: (state, payload) => ({ ...state, editCollectionId: payload.modId }),
    startAddModsToCollection: (state, payload) => ({ ...state, addModsId: payload.collectionId }),
    healthDownvoteDialog: (state, payload) => ({
      ...state,
      healthDownvoteDialog: payload.collectionModId,
    }),
  },
);

export default sessionReducer;
