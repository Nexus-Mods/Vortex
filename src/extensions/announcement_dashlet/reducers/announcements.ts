import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions';

const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.setAnnouncements as any]: (state, payload) =>
      setSafe(state, ['announcements'], payload),
  },
  defaults: {
    announcements: [],
  },
};

export default sessionReducer;
