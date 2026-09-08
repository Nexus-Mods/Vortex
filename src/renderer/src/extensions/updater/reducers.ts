import type { UpdaterSnapshot } from "@vortex/shared/ipc";
import update from "immutability-helper";

import type { IReducerSpec } from "../../types/IExtensionContext";
import { setUpdateChannel, setUpdaterSnapshot } from "./actions";

/** session.updater: what the updater is doing, as last polled from main */
export interface IUpdaterSessionState {
  snapshot?: UpdaterSnapshot;
}

export const sessionReducer: IReducerSpec = {
  reducers: {
    [setUpdaterSnapshot as any]: (state, payload) => update(state, { snapshot: { $set: payload } }),
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
