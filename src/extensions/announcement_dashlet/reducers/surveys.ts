import * as _ from 'lodash';
import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions';

const surveySessionReducer: IReducerSpec = {
  reducers: {
    [actions.setAvailableSurveys as any]: (state, payload) =>
      setSafe(state, ['available'], payload),
  },
  defaults: {
  },
};

export default surveySessionReducer;
