import { createAction } from "redux-act";

import type { MediaSource, ModMediaTag } from "../util/mediaTypes";

export const setGameMediaSources = createAction(
  "SET_GAME_MEDIA_SOURCES",
  (gameId: string, sources: Record<string, MediaSource>) => ({
    gameId,
    sources,
  }),
);

export const setGameMediaModTags = createAction(
  "SET_GAME_MEDIA_MOD_TAGS",
  (gameId: string, mediaId: string, tags: ModMediaTag[]) => ({
    gameId,
    mediaId,
    tags,
  }),
);
