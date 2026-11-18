import { types, util } from "@nexusmods/vortex-api";

import * as actions from "./actions";

/** `session.metaEditor` */
export interface IMetaEditorSessionState {
  /** id of the download the editor is shown for; `false` (or `undefined`) while it's hidden */
  showDialog: string | false | undefined;
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
const sessionReducer = util.actionsToReducerSpec<IMetaEditorSessionState, typeof actions>(
  { showDialog: false },
  actions,
  {
    setShowMetaEditor: (state, payload) => util.setSafe(state, ["showDialog"], payload),
  },
);

export default sessionReducer;
