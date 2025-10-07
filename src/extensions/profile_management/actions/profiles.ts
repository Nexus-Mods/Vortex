import safeCreateAction from '../../../actions/safeCreateAction';
import { log } from '../../../util/log';

import Bluebird from 'bluebird';
import * as reduxAct from 'redux-act';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { batchDispatch } from '../../../util/util';
import { IProfile } from '../types/IProfile';

/**
 * add or edit a profile
 */
export const setProfile = safeCreateAction('SET_PROFILE', (profile: IProfile) => profile);

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
  installed?: boolean;
  allowAutoDeploy?: boolean;
  willBeReplaced?: boolean;
}

const setModsEnabled = (() => {
  let ppFunc: (profileId: string, modIds: string[],
               enabled: boolean, options: IEnableOptions) => Bluebird<void>;

  return (api: IExtensionApi, profileIdIn: string, modIdsIn: string[],
          enableIn: boolean, optionsIn?: IEnableOptions) => {
    const { profileById } = require('../selectors');

    if (ppFunc === undefined) {
      ppFunc = api.withPrePost('enable-mods',
                               (profileId: string, modIds: string[], enable: boolean, options: IEnableOptions) => {
                                 try {
                                   log('info', 'mods enablement requested', {
                                     profileId,
                                     modIds,
                                     enable,
                                     options,
                                     count: modIds.length,
                                   });
                                 } catch (_) { /* noop */ }

                                 if (modIds.length > 0) {
                                   const profile: IProfile = profileById(api.getState(), profileId);
                                   if (profile !== undefined) {
                                     batchDispatch(api.store, modIds.map(id => setModEnabled(profileId, id, enable)));
                                     api.events.emit('mods-enabled', modIds, enable, profile.gameId, options);
                                     try {
                                       log('debug', 'mods enablement applied', {
                                         profileId,
                                         gameId: profile.gameId,
                                         enable,
                                         modIds,
                                       });
                                     } catch (_) { /* noop */ }
                                   }
                                 } else {
                                   try {
                                     log('debug', 'mods enablement noop', { profileId, enable });
                                   } catch (_) { /* noop */ }
                                 }

                                 return Bluebird.resolve();
                               });
    }

    {
      const profile: IProfile = profileById(api.getState(), profileIdIn);
      if (profile === undefined) {
        return Bluebird.resolve();
      }
      const willChange = modIdsIn.filter(id =>
        (profile.modState?.[id]?.enabled ?? false) !== enableIn);
      return ppFunc(profileIdIn, willChange, enableIn, optionsIn)
        .then(() => {
          try {
            log('info', 'mods enablement completed', {
              profileId: profileIdIn,
              enabled: enableIn,
              modIds: willChange,
              count: willChange.length,
            });
          } catch (_) { /* noop */ }
        })
        .catch(err => {
          try {
            log('error', 'mods enablement failed', {
              profileId: profileIdIn,
              enabled: enableIn,
              error: err?.message,
            });
          } catch (_) { /* noop */ }
          api.showErrorNotification('Failed to enable/disable mod', err);
        });
    }
  };
})();

export {
  setModsEnabled,
};
