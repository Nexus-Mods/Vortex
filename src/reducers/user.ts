import * as actions from '../actions/user';
import {IReducerSpec} from '../types/IExtensionContext';
import {setSafe} from '../util/storeHelper';

export const userReducer: IReducerSpec = {
  reducers: {
    [actions.setMultiUser as any]: (state, payload) => setSafe(state, ['multiUser'], payload),
  },
  defaults: {
    multiUser: false,
  },
  verifiers: {
    multiUser: {
      description: () =>
        'Choice of "shared"/"per-user" mode was not stored, defaulting to "per-user" mode.',
      type: 'boolean',
    },
  },
};
