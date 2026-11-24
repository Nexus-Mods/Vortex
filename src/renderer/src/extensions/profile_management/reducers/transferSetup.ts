import type { VortexGameId } from "@vortex/shared";

import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/transferSetup";

/** One end of the line drawn while dragging a profile onto another to transfer mods. */
export interface IProfileConnectionEnd {
  // profile id; null on the target while it isn't over a profile
  id: string | null;
  pos: { x: number; y: number };
}

/** The profiles the mod transfer dialog transfers between, and their game. */
export interface IProfileTransferDialog {
  gameId: VortexGameId;
  source: string;
  target: string;
}

/** session.profileTransfer: state of transferring enabled mods between profiles */
export interface IProfileTransferState {
  connection?: {
    source?: IProfileConnectionEnd;
    target?: IProfileConnectionEnd;
  };
  dialog?: IProfileTransferDialog;
}

declare module "@/types/IState" {
  interface ISessionState {
    profileTransfer: IProfileTransferState;
  }
}

const userlistReducer = actionsToReducerSpec<IProfileTransferState, typeof actions>(
  {
    connection: undefined,
    dialog: undefined,
  },
  actions,
  {
    setSource: (state, payload) => {
      if (payload.pos !== undefined) {
        return { ...state, connection: { ...state.connection, source: payload } };
      } else if (payload.id === state.connection?.source?.id) {
        return { ...state, connection: { ...state.connection, source: undefined } };
      } else {
        return state;
      }
    },
    setTarget: (state, payload) => {
      if (
        payload.pos !== undefined &&
        (payload.id !== null ||
          state.connection === undefined ||
          state.connection.target === undefined ||
          state.connection.target.id === undefined ||
          state.connection.target.id === null)
      ) {
        return { ...state, connection: { ...state.connection, target: payload } };
      } else if (payload.id === state.connection?.target?.id) {
        return { ...state, connection: { ...state.connection, target: undefined } };
      } else {
        return state;
      }
    },
    setCreateTransfer: (state, payload) => ({ ...state, dialog: payload }),
    closeDialog: (state) => ({ ...state, dialog: undefined }),
  },
);

export default userlistReducer;
