import { createAction } from "redux-act";

// index undefined clears the lock
export const lockPluginIndex = createAction(
  "SET_PLUGIN_LOCKED_INDEX",
  (gameId: string, plugin: string, index: number | undefined) => ({
    gameId,
    plugin,
    index,
  }),
);
