import * as _ from 'lodash';
import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions';

const persistentReducer: IReducerSpec = {
  reducers: {
    [actions.setSuppressSurvey as any]: (state, payload) =>
      setSafe(state, ['suppressed', payload.id], payload.suppress),
  },
  defaults: {
  },
};

export default persistentReducer;
