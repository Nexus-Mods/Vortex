import { createAction } from "redux-act";

export const lockPluginIndex = createAction(
  "SET_PLUGIN_LOCKED_INDEX",
  (gameId: string, plugin: string, index: number) => ({
    gameId,
    plugin,
    index,
  }),
);
