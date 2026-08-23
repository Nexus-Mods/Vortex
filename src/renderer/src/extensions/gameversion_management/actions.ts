import { createAction } from "redux-act";

import type { IGameVersionJob } from "./types/IGameVersionState";

export const setGameVersionJob = createAction(
  "SET_GAME_VERSION_JOB",
  (payload: { gameId: string; job?: IGameVersionJob }) => payload,
);
