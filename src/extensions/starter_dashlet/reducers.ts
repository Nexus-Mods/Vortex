import { IReducerSpec } from '../../types/IExtensionContext';
import { setSafe } from '../../util/storeHelper';
import * as actions from './actions';

const reducer: IReducerSpec = {
  reducers: {
    [actions.setPrimaryTool as any]: (state, payload) =>
      setSafe(state, ['primaryTool', payload.gameId], payload.toolId),
    [actions.setAddToTitleBar as any]: (state, payload) => {
      const { gameId, addToTitleBar } = payload;
      return setSafe(state, ['tools', 'addToolsToTitleBar', gameId], addToTitleBar);
    },
    [actions.setToolOrder as any]: (state, payload) => {
      const { gameId, tools } = payload;
      return setSafe(state, ['tools', 'order', gameId], tools);
    },
  },
  defaults: {
    tools: {
      addToolsToTitleBar: false,
      order: [],
    },
  },
};

export default reducer;
