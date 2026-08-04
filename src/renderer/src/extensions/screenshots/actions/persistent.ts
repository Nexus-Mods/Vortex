import { createAction } from "redux-act";

export const setGameMediaSources = createAction(
  "SET_GAME_MEDIA_SOURCES",
  (gameId: string, sources: { [key: string]: { path: string; active: boolean } }) => ({
    gameId,
    sources,
  }),
);
