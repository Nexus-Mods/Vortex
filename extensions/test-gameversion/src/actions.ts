import type { VortexGameId } from "@nexusmods/vortex-api";
import { createAction } from "redux-act";

export const setGameVersion = createAction(
  "SET_GAME_VERSION",
  (gameId: VortexGameId, version: string) => ({ gameId, version }),
);
