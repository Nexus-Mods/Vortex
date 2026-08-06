import type { IUpdateEntry } from "@nexusmods/nexus-api";
import { createAction } from "redux-act";

export const setLoginId = createAction("SET_LOGIN_ID", (id: string | undefined) => id);

export const setOauthPending = createAction("SET_OAUTH_PENDING", (url: string) => url);

export const setLoginError = createAction("SET_LOGIN_ERROR", (error: string | undefined) => error);

/**
 * store last time we checked for updates
 */
export const setLastUpdateCheck = createAction(
  "SET_LAST_UPDATE_CHECK",
  (gameId: string, time: number, range: number, updateList: IUpdateEntry[]) => ({
    gameId,
    time,
    range,
    updateList,
  }),
);

export const addFreeUserDLItem = createAction("ADD_FREEUSER_DLITEM", (url: string) => url);

export const removeFreeUserDLItem = createAction("REMOVE_FREEUSER_DLITEM", (url: string) => url);
