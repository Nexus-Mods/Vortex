import type { IReducerSpec } from "@/types/IExtensionContext";
import { reducerFor } from "@/util/reducerFor";

import * as actions from "../actions/session";
import type { GameMediaItem } from "../util/mediaTypes";
import { sortMedia } from "../util/sortMedia";

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
    on(actions.replaceSourceGameMedia, (state, payload) => {
      const { sourceId, media } = payload;
      return {
        ...state,
        items: [...(state.items ?? []).filter((i) => i.sourceId !== sourceId), ...media].sort(
          sortMedia,
        ),
      };
    }),
  ]),
  defaults: {
    items: null,
  },
};
