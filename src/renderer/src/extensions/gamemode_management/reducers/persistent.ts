import { log } from "@/logging";
import { actionsToReducerSpec } from "@/reducers/builder";
import type {
  IGameInfoEntry,
  IGameUidRetirement,
  ITierZeroGame,
  IStateGameMode,
} from "@/types/IState";

import * as actions from "../actions/persistent";

/** a non-empty lowercase uid, so it compares with the uids the backend sends */
function isUid(uid: unknown): boolean {
  return typeof uid === "string" && uid !== "" && uid === uid.toLowerCase();
}

function isValidRetirement(entry: IGameUidRetirement): boolean {
  if (!isUid(entry.retired) || !isUid(entry.current)) {
    log("error", "Dropping a game uid retirement that has a malformed uid", { entry });
    return false;
  }
  if (entry.retired === entry.current) {
    log("error", "Dropping a game uid retirement that maps a uid to itself", { entry });
    return false;
  }
  return true;
}

export const persistentReducer = actionsToReducerSpec<IStateGameMode, typeof actions>(
  {
    gameInfo: {},
    gameUidHistory: [],
    tier0: {},
  },
  actions,
  {
    appendGameUidRetirements: (state, payload) => {
      const valid = payload.entries.filter(isValidRetirement);
      if (valid.length === 0) {
        return state;
      }
      return { ...state, gameUidHistory: [...state.gameUidHistory, ...valid] };
    },
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
    setManualInstallerPreferences: (state, payload) => {
      const existing = state.tier0[payload.gameId];
      if (existing === undefined) {
        return state;
      }
      return {
        ...state,
        tier0: {
          ...state.tier0,
          [payload.gameId]: { ...existing, manualInstallerPreferences: payload.preferences },
        },
      };
    },
    removeTierZeroGame: (state, payload) => {
      if (state.tier0[payload.gameId] === undefined) {
        return state;
      }
      const { [payload.gameId]: _removed, ...rest } = state.tier0;
      return { ...state, tier0: rest };
    },
  },
);
