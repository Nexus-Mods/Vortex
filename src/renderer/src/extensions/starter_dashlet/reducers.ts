import type { IReducerSpec } from "../../types/IExtensionContext";
import { setSafe } from "../../util/storeHelper";
import * as actions from "./actions";

const reducer: IReducerSpec = {
  reducers: {
    [actions.setPrimaryTool as any]: (state, payload) =>
      setSafe(state, ["primaryTool", payload.gameId], payload.toolId),
    [actions.setToolOrder as any]: (state, payload) => {
      const { gameId, tools } = payload;
      return setSafe(state, ["tools", "order", gameId], tools);
    },
    [actions.setToolValid as any]: (state, payload) => {
      const { gameId, toolId, valid } = payload;
      return setSafe(state, ["tools", "valid", gameId, toolId], valid);
    },
    [actions.setToolPinned as any]: (state, payload) => {
      const { gameId, toolId, pinned } = payload;
      return setSafe(state, ["tools", "pinned", gameId, toolId], pinned);
    },
  },
  defaults: {},
};

export default reducer;
