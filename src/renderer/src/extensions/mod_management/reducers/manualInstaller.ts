import type { VortexGameId, VortexModStagingFolder } from "@vortex/shared";

import { actionsToReducerSpec } from "@/reducers/builder";
import type { FileTreeEntry } from "@/ui/components/file_tree/buildTree";

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
  /**
   * the game's install folder, as a native path. The dialog reads the game's folder tree from
   * it, so the trees show what the game actually has, as do the result list's conflict markers.
   * A string, as state only holds serializable data.
   */
  gameFolder: string;
  /** every entry of the archive, with its path relative to the archive's root */
  files: FileTreeEntry[];
  /**
   * the staging folders of the mod being installed, and of the mod it replaces, if any. Files
   * deployed from them don't count as another mod's.
   */
  ownStagingFolders: VortexModStagingFolder[];
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
