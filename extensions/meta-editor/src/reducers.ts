import { types, util } from "@nexusmods/vortex-api";

import * as actions from "./actions";

/** `session.metaEditor` */
export interface IMetaEditorSessionState {
  /** id of the download the editor is shown for; `false` (or `undefined`) while it's hidden */
  showDialog: string | false;
}

declare module "@nexusmods/vortex-api" {
  namespace types {
    interface ISessionState {
      metaEditor: IMetaEditorSessionState;
    }
  }
}

/**
 * reducer for changes to ephemeral session state
 */
const sessionReducer: types.IReducerSpec<IMetaEditorSessionState> = {
  reducers: {
    [actions.setShowMetaEditor as any]: (state: IMetaEditorSessionState, payload: string) =>
      util.setSafe(state, ["showDialog"], payload),
  },
  defaults: {
    showDialog: false,
  },
};

export default sessionReducer;
