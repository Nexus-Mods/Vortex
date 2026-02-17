import createAction from "../../../renderer/actions/safeCreateAction";
import type { IItemRendererOptions } from "../types/types";

// Can be used to store game specific load order options
//  for the specified gameId.
export const setGameLoadOrderRendererOptions = createAction(
  "SET_LOAD_ORDER_RENDERER_OPTIONS",
  (gameId: string, itemRendererOptions: IItemRendererOptions) => ({
    gameId,
    itemRendererOptions,
  }),
) as any;
