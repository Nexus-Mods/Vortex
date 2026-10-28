import type { VortexGameId } from "@vortex/shared";

import { actionsToReducerSpec } from "@/reducers/builder";

import * as actions from "../actions/manualInstaller";

/** a mod waiting for the user to choose its destination folder */
export interface IManualInstallerRequest {
  id: string;
  gameId: VortexGameId;
  /** name of the mod being installed */
  modName: string;
  /** how many more installs of the same batch are still to come after this one */
  remaining: number;
  /** the game's default folder, preselected in the dialog */
  defaultFolder?: string;
  /** the first few files of the archive, for the preview of the final paths */
  previewFiles: string[];
  /** the single folder all files of the archive are in, if there is one */
  topFolder?: string;
}

export interface IManualInstallerState {
  /** the dialog shows the first request */
  pending: IManualInstallerRequest[];
}

declare module "@/types/IState" {
  interface ISessionState {
    manualInstaller: IManualInstallerState;
  }
}

export const manualInstallerReducer = actionsToReducerSpec<IManualInstallerState, typeof actions>(
  { pending: [] },
  actions,
  {
    enqueueManualInstallerRequest: (state, payload) => ({
      ...state,
      pending: [...state.pending, payload],
    }),
    dequeueManualInstallerRequest: (state, payload) => ({
      ...state,
      pending: state.pending.filter((request) => request.id !== payload),
    }),
  },
);
