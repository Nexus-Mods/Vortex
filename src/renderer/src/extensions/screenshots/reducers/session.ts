import { reducerFor } from "@/extensions/health_check/reducers/reducerFor";
import type { IReducerSpec } from "@/types/api";
import { setSafe } from "@/util/storeHelper";

import * as actions from "../actions/session";
import type { MediaItem } from "../util/mediaTypes";

export interface IGameMediaSessionState {
  items: MediaItem[] | null;
}

const on = reducerFor<IGameMediaSessionState>();

export const sessionReducer: IReducerSpec<IGameMediaSessionState> = {
  reducers: Object.fromEntries([
    on(actions.setFoundGameMedia, (state, payload) => {
      const { media } = payload;
      return setSafe(state, ["items"], media);
    }),
  ]),
  defaults: {
    items: null,
  },
};
