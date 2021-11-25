import safeCreateAction from '../../../actions/safeCreateAction';

import Bluebird from 'bluebird';
import * as reduxAct from 'redux-act';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { batchDispatch } from '../../../util/util';

/**
 * add or edit a profile
 */
export const setProfile = safeCreateAction('SET_PROFILE', profileId => profileId);

export const removeProfile = safeCreateAction('REMOVE_PROFILE', profileId => profileId);

export const willRemoveProfile = safeCreateAction('WILL_REMOVE_PROFILE', profileId => profileId);

/**
 * enable or disable a mod in a profile
 */
export const setModEnabled = safeCreateAction(
  'SET_MOD_ENABLED',
  (profileId: string, modId: string, enable: boolean) => ({profileId, modId, enable}));

export const forgetMod = safeCreateAction(
  'FORGET_PROFILE_MOD',
  (profileId: string, modId: string) => ({ profileId, modId }));

export const setFeature = safeCreateAction(
  'SET_PROFILE_FEATURE',
  (profileId: string, featureId: string, value: any) => ({profileId, featureId, value}));

export const setProfileActivated =
  safeCreateAction('SET_PROFILE_ACTIVATED', (active: string) => active);

export interface IEnableOptions {
  silent: boolean;
  installed: boolean;
}

const setModsEnabled = (() => {
  let ppFunc: (profileId: string, modIds: string[],
               enabled: boolean, options: IEnableOptions) => Bluebird<void>;

  return (api: IExtensionApi, profileIdIn: string, modIdsIn: string[],
          enableIn: boolean, optionsIn?: IEnableOptions) => {
    if (ppFunc === undefined) {
      ppFunc = api.withPrePost('enable-mods',
        (profileId: string, modIds: string[], enable: boolean, options: IEnableOptions) => {
          batchDispatch(api.store, modIds.map(id => setModEnabled(profileId, id, enable)));
          const { profileById } = require('../selectors');
          const profile = profileById(api.getState(), profileId);
          api.events.emit('mods-enabled', modIds, enable, profile.gameId, options);

          return Bluebird.resolve();
      });
    }

    return ppFunc(profileIdIn, modIdsIn, enableIn, optionsIn)
      .catch(err => {
        api.showErrorNotification('Failed to enable/disable mod', err);
      });
  };
})();

export {
  setModsEnabled,
};
