import type { UpdaterSnapshot } from "@vortex/shared/ipc";
import update from "immutability-helper";

import type { IReducerSpec } from "../../types/IExtensionContext";
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

export const sessionReducer: IReducerSpec = {
  reducers: {
    [setUpdaterSnapshot as any]: (state, payload) => update(state, { snapshot: { $set: payload } }),
    [setWhatsNew as any]: (state, payload) => update(state, { whatsNew: { $set: payload } }),
  },
  defaults: {} satisfies IUpdaterSessionState,
};

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [setUpdateChannel as any]: (state, payload) => update(state, { channel: { $set: payload } }),
  },
  defaults: {
    channel: "stable",
  },
};

export default settingsReducer;
