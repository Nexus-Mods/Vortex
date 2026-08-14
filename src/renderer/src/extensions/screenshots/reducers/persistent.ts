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
      let newArray: string[] = state.disabledSources[gameId] ?? [];
      if (enabled && !newArray.includes(sourceId)) newArray = [sourceId, ...newArray];
      if (!enabled && newArray.includes(sourceId))
        newArray = newArray.filter((s) => s !== sourceId);
      return { ...state, disabledSources: { [gameId]: newArray } };
    }),
    on(actions.addGameMediaSource, (state, payload) => {
      const { gameId, sourceId, source } = payload;
      return {
        ...state,
        sources: { ...state.sources, [gameId]: { ...state.sources[gameId], [sourceId]: source } },
      };
    }),
    on(actions.deleteGameMediaSource, (state, payload) => {
      const { gameId, sourceId } = payload;
      const newSources = { ...state.sources[gameId] };
      delete newSources[sourceId];
      return { ...state, sources: { ...state.sources, [gameId]: newSources } };
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
