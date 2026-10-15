import { setStoreGameVersionCache } from "@/extensions/analytics/actions/telemetry.action";
import type { IStoreGameVersionCacheEntry } from "@/extensions/analytics/types/telemetry";
import { actionsToReducerSpec } from "@/reducers/builder";

/** Owns the store-game-version cache under persistent.analyticsTelemetry; it must
    survive Vortex sessions, so an unchanged install never re-sends. */
export interface IAnalyticsTelemetryState {
  storeGameVersions: { [gameId: string]: IStoreGameVersionCacheEntry };
}

declare module "@/types/IState" {
  interface IPersistentState {
    analyticsTelemetry: IAnalyticsTelemetryState;
  }
}

const defaultState: IAnalyticsTelemetryState = {
  storeGameVersions: {},
};

export default actionsToReducerSpec<IAnalyticsTelemetryState, { setStoreGameVersionCache }>(
  defaultState,
  { setStoreGameVersionCache },
  {
    setStoreGameVersionCache: (state, { gameId, cache }) => {
      if (cache === null) {
        const { [gameId]: _removed, ...remaining } = state.storeGameVersions;
        return { storeGameVersions: remaining };
      }
      return { storeGameVersions: { ...state.storeGameVersions, [gameId]: cache } };
    },
  },
);
