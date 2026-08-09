import { reducerFor } from "@/extensions/health_check/reducers/reducerFor";
import type { IReducerSpec } from "@/types/api";

import * as actions from "../actions/persistent";
import type { MediaSource, ModMediaTag } from "../util/mediaTypes";

export interface IGameMediaPersistentState {
  sources: {
    [gameId: string]: Record<string, MediaSource> | undefined;
  };
  modTags: {
    [gameId: string]: { [imageId: string]: ModMediaTag[] };
  };
}

const on = reducerFor<IGameMediaPersistentState>();

export const persistentReducer: IReducerSpec<IGameMediaPersistentState> = {
  reducers: Object.fromEntries([
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
  },
};
