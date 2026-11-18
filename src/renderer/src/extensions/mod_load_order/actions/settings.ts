import type { VortexGameId } from "@vortex/shared";

import createAction from "../../../actions/safeCreateAction";
import type { IItemRendererOptions } from "../types/types";

// Can be used to store game specific load order options
//  for the specified gameId.
export const setGameLoadOrderRendererOptions = createAction(
  "SET_LOAD_ORDER_RENDERER_OPTIONS",
  (gameId: VortexGameId, itemRendererOptions: IItemRendererOptions) => ({
    gameId,
    itemRendererOptions,
  }),
);
