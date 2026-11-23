import type { VortexGameId } from "@vortex/shared";

import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/settings";
import type { IItemRendererOptions } from "../types/types";

/** settings.loadOrder: options of the legacy load order page */
export interface ISettingsLoadOrder {
  // absent until a game's options are first set
  rendererOptions?: Record<VortexGameId, IItemRendererOptions>;
}

declare module "@/types/IState" {
  interface ISettings {
    loadOrder: ISettingsLoadOrder;
  }
}

export const loadOrderSettingsReducer = actionsToReducerSpec<ISettingsLoadOrder, typeof actions>(
  {},
  actions,
  {
    setGameLoadOrderRendererOptions: (state, payload) => {
      const { gameId, itemRendererOptions } = payload;
      return {
        ...state,
        rendererOptions: { ...state.rendererOptions, [gameId]: itemRendererOptions },
      };
    },
  },
);
