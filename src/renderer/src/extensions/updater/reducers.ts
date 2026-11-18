import type { UpdaterSnapshot } from "@vortex/shared/ipc";

import { actionsToReducerSpec } from "../../reducers/builder";
import type { ISettingsUpdate } from "../../types/IState";
import { setUpdateChannel, setUpdaterSnapshot, setWhatsNew } from "./actions";

/** What the What's New dialog shows: a version's release notes, and the update on offer, if any. */
export interface IWhatsNew {
  version: string;
  notes?: string;
  action?: "download" | "restart";
}

/** session.updater: what the updater is doing, as last polled from main */
export interface IUpdaterSessionState {
  snapshot?: UpdaterSnapshot;
  whatsNew?: IWhatsNew;
}

const sessionActions = { setUpdaterSnapshot, setWhatsNew };
const settingsActions = { setUpdateChannel };

export const sessionReducer = actionsToReducerSpec<IUpdaterSessionState, typeof sessionActions>(
  {},
  sessionActions,
  {
    setUpdaterSnapshot: (state, payload) => ({ ...state, snapshot: payload }),
    setWhatsNew: (state, payload) => ({ ...state, whatsNew: payload }),
  },
);

/**
 * reducer for changes to update settings
 */
const settingsReducer = actionsToReducerSpec<ISettingsUpdate, typeof settingsActions>(
  { channel: "stable" },
  settingsActions,
  {
    setUpdateChannel: (state, payload) => ({ ...state, channel: payload }),
  },
);

export default settingsReducer;
