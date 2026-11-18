import {
  setGameFolderCheckMarker,
  setStoreGameVersionCache,
} from "@/extensions/analytics/actions/telemetry.action";
import type {
  IGameFolderCheckMarker,
  IStoreGameVersionCacheEntry,
} from "@/extensions/analytics/types/telemetry";
import { actionsToReducerSpec } from "@/reducers/builder";

/** Owns the store-game-version cache and the game folder check markers under
    persistent.analyticsTelemetry; both must survive Vortex sessions. */
export interface IAnalyticsTelemetryState {
  storeGameVersions: { [gameId: string]: IStoreGameVersionCacheEntry };
  /** missing from state persisted before the game folder check existed */
  gameFolderChecks?: { [gameId: string]: IGameFolderCheckMarker };
}

declare module "@/types/IState" {
  interface IPersistentState {
    analyticsTelemetry: IAnalyticsTelemetryState;
  }
}

const defaultState: IAnalyticsTelemetryState = {
  storeGameVersions: {},
  gameFolderChecks: {},
};

export default actionsToReducerSpec<
  IAnalyticsTelemetryState,
  { setStoreGameVersionCache; setGameFolderCheckMarker }
>(
  defaultState,
  { setStoreGameVersionCache, setGameFolderCheckMarker },
  {
    setStoreGameVersionCache: (state, { gameId, cache }) => {
      if (cache === null) {
        const { [gameId]: _removed, ...remaining } = state.storeGameVersions;
        return { ...state, storeGameVersions: remaining };
      }
      return { ...state, storeGameVersions: { ...state.storeGameVersions, [gameId]: cache } };
    },
    setGameFolderCheckMarker: (state, { gameId, marker }) => ({
      ...state,
      gameFolderChecks: { ...state.gameFolderChecks, [gameId]: marker },
    }),
  },
);
