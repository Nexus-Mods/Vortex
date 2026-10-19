import { actionsToReducerSpec } from "@/reducers/builder";
import type { IGameInfoEntry, IStateGameMode } from "@/types/IState";

import * as actions from "../actions/persistent";

export const persistentReducer = actionsToReducerSpec<IStateGameMode, typeof actions>(
  {
    gameInfo: {},
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
  },
);
