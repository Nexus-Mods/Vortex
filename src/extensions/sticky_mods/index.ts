/**
 * warns when a mod gets enabled that is "sticky" and will integrate into the
 * savegame in such a way that it can't be removed (at least not automatically)
 */

import {IExtensionApi, IExtensionContext} from '../../types/IExtensionContext';
import {IState} from '../../types/IState';
import LazyComponent from '../../util/LazyComponent';

import renderModName from '../mod_management/util/modName';
import {activeProfile} from '../profile_management/selectors';
import {IProfile} from '../profile_management/types/IProfile';

function testModSticky(api: IExtensionApi, previous: IProfile, current: IProfile) {
  const state: IState = api.store.getState();

  const mods = state.persistent.mods[current.gameId];
  Object.keys(previous.modState)
      .forEach(modId => {
        if ((mods[modId].attributes['sticky'] === true) &&
            !previous.modState[modId].enabled &&
            current.modState[modId].enabled) {
          api.sendNotification({
            type: 'warning',
            message: api.translate(
                '{{ modName }} is "sticky". Disabling it at a later time will probably '
                + ' make all savegames created with it unusable. Keep a backup!',
                {replace: {modName: renderModName(mods[modId])}}),
          });
        }
      });
}

function init(context: IExtensionContext): boolean {
  context.once(() => {
    context.api.onStateChange(['persistent', 'profiles'],
      (previous: { [profileId: string]: IProfile }, current: { [profileId: string]: IProfile }) => {
        Object.keys(previous).forEach(profileId => {
          if ((previous[profileId] !== current[profileId]) && (current[profileId] !== undefined)) {
            testModSticky(context.api, previous[profileId], current[profileId]);
          }
        });
    });
  });

  return true;
}

export default init;
