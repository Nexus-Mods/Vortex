import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/settings';

export const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setInstallerSandbox as any]:
        (state, payload) => setSafe(state, ['installerSandbox'], payload),
  },
  defaults: {
    installerSandbox: true,
  },
};