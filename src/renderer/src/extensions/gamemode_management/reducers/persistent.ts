import { actionsToReducerSpec } from "@/reducers/builder";
import type { IGameInfoEntry, ITierZeroGame, IStateGameMode } from "@/types/IState";

import * as actions from "../actions/persistent";

export const persistentReducer = actionsToReducerSpec<IStateGameMode, typeof actions>(
  {
    gameInfo: {},
    tier0: {},
  },
  actions,
  {
    setGameInfo: (state, payload) => {
      const { gameId, provider, priority, expires, values } = payload;
      return {
        ...state,
        gameInfo: {
          ...state.gameInfo,
          [gameId]: {
            ...state.gameInfo[gameId],
            ...Object.fromEntries(
              values.map((val) => [
                val.key,
                {
                  key: val.key,
                  provider,
                  priority,
                  expires,
                  title: val.title,
                  value: val.value,
                } satisfies IGameInfoEntry,
              ]),
            ),
          },
        },
      };
    },
    setTierZeroGame: (state, payload) => ({
      ...state,
      tier0: { ...state.tier0, [payload.gameId]: payload.entry },
    }),
    removeTierZeroGame: (state, payload) => {
      if (state.tier0[payload.gameId] === undefined) {
        return state;
      }
      const { [payload.gameId]: _removed, ...rest } = state.tier0;
      return { ...state, tier0: rest };
    },
  },
);
