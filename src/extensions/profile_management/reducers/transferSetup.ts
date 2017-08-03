import { IReducerSpec } from '../../../types/IExtensionContext';
import { getSafe, setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/transferSetup';

const userlistReducer: IReducerSpec = {
  reducers: {
    [actions.setSource as any]: (state, payload) => {
      if (payload.pos !== undefined) {
        return setSafe(state, ['connection', 'source'], payload);
      } else if (payload.id === getSafe(state, ['connection', 'source', 'id'], undefined)) {
        return setSafe(state, ['connection', 'source'], undefined);
      } else {
        return state;
      }
    },
    [actions.setTarget as any]: (state, payload) => {
      if ((payload.pos !== undefined)
          && ((payload.id !== null)
              || (state.connection === undefined)
              || (state.connection.target === undefined)
              || (state.connection.target.id === undefined)
              || (state.connection.target.id === null))) {
        return setSafe(state, ['connection', 'target'], payload);
      } else if (payload.id === getSafe(state, ['connection', 'target', 'id'], undefined)) {
        return setSafe(state, ['connection', 'target'], undefined);
      } else {
        return state;
      }
    },
    [actions.setCreateTransfer as any]: (state, payload) =>
      setSafe(state, ['dialog'], payload),
    [actions.closeDialog as any]: (state, payload) =>
      setSafe(state, ['dialog'], undefined),
  },
  defaults: {
    connection: undefined,
    dialog: undefined,
  },
};

export default userlistReducer;
