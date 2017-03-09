import { IReducerSpec } from '../../types/IExtensionContext';
import { setSafe } from '../../util/storeHelper';
import * as actions from './actions';

const reducer: IReducerSpec = {
  reducers: {
    [actions.setPrimaryTool as any]: (state, payload) =>
      setSafe(state, ['primaryTool', payload.gameId], payload.toolId),
  },
  defaults: {
  },
};

export default reducer;
