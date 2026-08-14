import { reducerFor } from "@/extensions/health_check/reducers/reducerFor";
import type { IReducerSpec } from "@/types/api";

import * as actions from "../actions/persistent";
import type { GameMediaSource, GameMediaModTag } from "../util/mediaTypes";

export interface IGameMediaPersistentState {
  sources: {
    [gameId: string]: Record<string, GameMediaSource> | undefined;
  };
  modTags: {
    [gameId: string]: { [imageId: string]: GameMediaModTag[] };
  };
  disabledSources: Record<string, string[]>;
}

const on = reducerFor<IGameMediaPersistentState>();

export const persistentReducer: IReducerSpec<IGameMediaPersistentState> = {
  reducers: Object.fromEntries([
    on(actions.setGameMediaSourceEnabled, (state, payload) => {
      const { gameId, sourceId, enabled } = payload;
      let newArray: string[] = state[gameId] ?? [];
      if (enabled && !newArray.includes(sourceId)) newArray.push(sourceId);
      if (!enabled && newArray.includes(sourceId))
        newArray = newArray.filter((s) => s !== sourceId);
      return { ...state, disabledSources: { [gameId]: newArray } };
    }),
    on(actions.setGameMediaSources, (state, payload) => {
      const { gameId, sources } = payload;
      return { ...state, sources: { ...state.sources, [gameId]: sources } };
    }),
    on(actions.setGameMediaModTags, (state, payload) => {
      const { gameId, mediaId, tags } = payload;
      if (!tags || !tags.length) {
        const gameModTags = state.modTags[gameId];
        if (!gameModTags?.[mediaId]) return state;

        const nextGameModTags = { ...gameModTags };
        delete nextGameModTags[mediaId];

        const nextModTags = { ...state.modTags };
        if (Object.keys(nextGameModTags).length === 0) {
          delete nextModTags[gameId];
        } else {
          nextModTags[gameId] = nextGameModTags;
        }

        return { ...state, modTags: nextModTags };
      }
      return {
        ...state,
        modTags: {
          ...state.modTags,
          [gameId]: {
            ...state.modTags[gameId],
            [mediaId]: tags,
          },
        },
      };
    }),
  ]),
  defaults: {
    sources: {},
    modTags: {},
    disabledSources: {},
  },
};
