import { createAction } from "redux-act";

export const setGameInfo = createAction(
  "SET_GAME_INFO",
  (
    gameId: string,
    provider: string,
    priority: number,
    expires: number,
    values: Array<{ key: string; title: string; value: any }>,
  ) => ({ gameId, provider, priority, expires, values }),
);
