import { reducerFor } from "@/extensions/health_check/reducers/reducerFor";
import type { IReducerSpec } from "@/types/api";
import { setSafe } from "@/util/storeHelper";

import * as actions from "../actions/persistent";
import type { MediaSource } from "../util/mediaTypes";

export interface IGameMediaPersistentState {
  sources: {
    [gameId: string]: Record<string, MediaSource> | undefined;
  };
}

const on = reducerFor<IGameMediaPersistentState>();

export const persistentReducer: IReducerSpec<IGameMediaPersistentState> = {
  reducers: Object.fromEntries([
    on(actions.setGameMediaSources, (state, payload) => {
      const { gameId, sources } = payload;
      return setSafe(state, [gameId], sources);
    }),
  ]),
  defaults: {
    sources: {},
  },
};
