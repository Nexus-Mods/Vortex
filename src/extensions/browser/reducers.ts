import { IReducerSpec } from '../../types/IExtensionContext';
import { merge, setSafe } from '../../util/storeHelper';

import * as actions from './actions';

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [actions.showURL as any]: (state, payload) => {
      const { url, instructions, subscriber, skippable } = payload;
      return merge(state, [], { url, instructions, subscriber, skippable });
    },
    [actions.closeBrowser as any]: (state, payload) =>
      setSafe(state, ['url'], undefined),
  },
  defaults: {
    url: undefined,
    instructions: undefined,
    subscriber: undefined,
    skippable: undefined,
  },
};
