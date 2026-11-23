import { actionsToReducerSpec } from "@/reducers/builder";

import * as actions from "./actions";

/** a meta server Vortex queries for mod meta data */
export interface IMetaserver {
  url: string;
  cacheDurationSec: number;
  priority: number;
}

/** settings.metaserver: the user's configured meta servers */
export interface ISettingsMetaserver {
  // keyed by server id
  servers: { [id: string]: IMetaserver };
}

declare module "@/types/IState" {
  interface ISettings {
    metaserver: ISettingsMetaserver;
  }
}

// how long a server's results are cached unless it says otherwise
const DEFAULT_CACHE_DURATION_SEC = 86400;

/**
 * reducer for changes to meta server settings
 */
const settingsReducer = actionsToReducerSpec<ISettingsMetaserver, typeof actions>(
  { servers: {} },
  actions,
  {
    // addMetaserver's payload carries no cache duration (it is removeMetaserver's that has one),
    // so a server added through it always gets the default
    addMetaserver: (state, payload) => ({
      ...state,
      servers: {
        ...state.servers,
        [payload.id]: {
          url: payload.url,
          cacheDurationSec: DEFAULT_CACHE_DURATION_SEC,
          priority: Object.keys(state.servers).length,
        },
      },
    }),
    removeMetaserver: (state, payload) => {
      if (state.servers === undefined || !Object.hasOwn(state.servers, payload.id)) {
        return state;
      }
      const { [payload.id]: _, ...servers } = state.servers;
      return { ...state, servers };
    },
    setPriorities: (state, payload) => {
      const servers = { ...state.servers };
      payload.ids.forEach((id, idx) => {
        servers[id] = { ...state.servers[id], priority: idx };
      });
      return { ...state, servers };
    },
  },
);

export default settingsReducer;
