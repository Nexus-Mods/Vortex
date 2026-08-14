import { reducerFor } from "@/extensions/health_check/reducers/reducerFor";
import type { IReducerSpec } from "@/types/api";

import * as actions from "../actions/session";
import type { GameMediaItem } from "../util/mediaTypes";

export interface IGameMediaSessionState {
  items: GameMediaItem[] | null;
}

const on = reducerFor<IGameMediaSessionState>();

export const sessionReducer: IReducerSpec<IGameMediaSessionState> = {
  reducers: Object.fromEntries([
    on(actions.setFoundGameMedia, (state, payload) => {
      const { media } = payload;
      return { ...state, items: media };
    }),
  ]),
  defaults: {
    items: null,
  },
};
