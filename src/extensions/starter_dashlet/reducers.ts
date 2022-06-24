import { IReducerSpec } from '../../types/IExtensionContext';
import { setSafe } from '../../util/storeHelper';
import * as actions from './actions';

const reducer: IReducerSpec = {
  reducers: {
    [actions.setPrimaryTool as any]: (state, payload) =>
      setSafe(state, ['primaryTool', payload.gameId], payload.toolId),
    [actions.setToolOrder as any]: (state, payload) => {
      const { gameId, tools } = payload;
      return setSafe(state, ['tools', 'order', gameId], tools);
    },
  },
  defaults: {},
};

export default reducer;
