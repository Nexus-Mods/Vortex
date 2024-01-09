import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import { generate } from 'shortid';

import * as actions from '../actions/session';

export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.setFBForceUpdate as any]: (state, payload) => {
      const { profileId } = payload;
      const uId = generate();
      return setSafe(state, [profileId], uId);
    }
  },
  defaults: {},
};
