import type { IReducerSpec } from "@/types/IExtensionContext";
import { reducerFor } from "@/util/reducerFor";

import * as actions from "../actions/persistent";
import type { GameMediaModTag, ResolvedGameMediaSource } from "../util/mediaTypes";

export interface IGameMediaPersistentState {
  sources: {
    [gameId: string]: Record<string, ResolvedGameMediaSource> | undefined;
  };
  modTags: {
    [gameId: string]: { [imageId: string]: GameMediaModTag[] };
  };
  disabledSources: Record<string, string[]>;
  flags: {
    showVideos?: boolean;
    externalModTags?: boolean;
    [key: string]: boolean;
  };
  uploadedItems: {
    [gameId: string]: Record<string, { date: Date; url: string }>;
  };
}

const on = reducerFor<IGameMediaPersistentState>();

export const persistentReducer: IReducerSpec<IGameMediaPersistentState> = {
  reducers: Object.fromEntries([
    on(actions.setGameMediaSourceEnabled, (state, payload) => {
      const { gameId, sourceId, enabled } = payload;
      let newArray: string[] = state.disabledSources[gameId] ?? [];
      // To enable a source, remove it from the array
      if (enabled && newArray.includes(sourceId)) newArray = newArray.filter((s) => s !== sourceId);
      // To disable a source, add it to the array
      if (!enabled && !newArray.includes(sourceId)) newArray = [sourceId, ...newArray];
      return { ...state, disabledSources: { ...state.disabledSources, [gameId]: newArray } };
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
    on(actions.deleteGameMediaModTag, (state, payload) => {
      const { gameId, modId, mediaId } = payload;
      const currentTags = state.modTags[gameId]?.[mediaId];
      if (!currentTags) return state;
      const newTags = currentTags.filter((t) => t.id !== modId);
      return {
        ...state,
        modTags: { ...state.modTags, [gameId]: { ...state.modTags[gameId], [mediaId]: newTags } },
      };
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
    on(actions.clearGameMediaModTags, (state, payload) => {
      const { gameId, mediaIds } = payload;
      const gameTags = state.modTags[gameId];
      if (!gameTags) return state;

      const next = { ...gameTags };
      for (const id of mediaIds) delete next[id];

      const nextModTags = { ...state.modTags };
      if (Object.keys(next).length === 0) delete nextModTags[gameId];
      else nextModTags[gameId] = next;

      return { ...state, modTags: nextModTags };
    }),
    on(actions.setGameMetaFlag, (state, payload) => {
      const { flag, value } = payload;

      return { ...state, flags: { ...state.flags, [flag]: value } };
    }),
    on(actions.setMediaItemUploaded, (state, payload) => {
      const { gameId, mediaId, uploaded, url } = payload;
      if (uploaded && url)
        return {
          ...state,
          uploadedItems: {
            ...state.uploadedItems,
            [gameId]: { ...state.uploadedItems[gameId], [mediaId]: { date: new Date(), url } },
          },
        };
      else if (!uploaded) {
        const uploadedItems = { ...state.uploadedItems[gameId] };
        delete uploadedItems[mediaId];

        return { ...state, uploadedItems: { ...state.uploadedItems, [gameId]: uploadedItems } };
      }
    }),
  ]),
  defaults: {
    sources: {},
    modTags: {},
    disabledSources: {},
    flags: {
      showVideos: false,
      externalModTags: false,
    },
    uploadedItems: {},
  },
};
