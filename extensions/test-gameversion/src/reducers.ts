import { types, util, type VortexGameId } from "@nexusmods/vortex-api";

import * as actions from "./actions";

declare module "@nexusmods/vortex-api" {
  namespace types {
    /** The field of `persistent.gameMode` this extension owns; core owns the rest. */
    interface IStateGameMode {
      /** the game version last seen, per game */
      versions: Record<VortexGameId, string>;
    }
  }
}

const persistentReducer = util.actionsToPartialReducerSpec<types.IStateGameMode, typeof actions>(
  { versions: {} },
  actions,
  {
    setGameVersion: (state, payload) => {
      const { gameId, version } = payload;
      return util.setSafe(state, ["versions", gameId], version);
    },
  },
);

export default persistentReducer;
