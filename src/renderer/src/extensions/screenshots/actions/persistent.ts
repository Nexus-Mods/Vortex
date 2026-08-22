import { createAction } from "redux-act";

import type { GameMediaSource, GameMediaModTag } from "../util/mediaTypes";

export const addGameMediaSource = createAction(
  "ADD_GAME_MEDIA_SOURCE",
  (gameId: string, sourceId: string, source: GameMediaSource) => ({ gameId, sourceId, source }),
);

export const deleteGameMediaSource = createAction(
  "DELETE_GAME_MEDIA_SOURCE",
  (gameId: string, sourceId: string) => ({ gameId, sourceId }),
);

export const setGameMediaModTags = createAction(
  "SET_GAME_MEDIA_MOD_TAGS",
  (gameId: string, mediaId: string, tags: GameMediaModTag[]) => ({
    gameId,
    mediaId,
    tags,
  }),
);

export const deleteGameMediaModTag = createAction(
  "DELETE_GAME_MEDIA_MOD_TAG",
  (gameId: string, mediaId: string, modId: string) => ({
    gameId,
    mediaId,
    modId,
  }),
);

export const setGameMediaSourceEnabled = createAction(
  "SET_GAME_MEDIA_SOURCE_ENABLED",
  (gameId: string, sourceId: string, enabled: boolean) => ({
    gameId,
    sourceId,
    enabled,
  }),
);
