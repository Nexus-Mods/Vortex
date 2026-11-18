import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/settings";

/** settings.nexus */
export interface INexusSettings {
  /** whether Vortex is registered as the handler for nxm:// links; undefined until decided */
  associateNXM?: boolean;
}

declare module "@/types/IState" {
  interface ISettings {
    nexus: INexusSettings;
  }
}

/**
 * reducer for changes to the authentication
 */
export const settingsReducer = actionsToReducerSpec<INexusSettings, typeof actions>(
  {
    associateNXM: undefined,
  },
  actions,
  {
    setAssociatedWithNXMURLs: (state, payload) => ({ ...state, associateNXM: payload }),
  },
);
