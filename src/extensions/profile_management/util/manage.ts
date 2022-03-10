import Bluebird from 'bluebird';
import * as path from 'path';

import { IExtensionApi } from '../../../types/IExtensionContext';
import * as fs from '../../../util/fs';
import getVortexPath from '../../../util/getVortexPath';
import { log } from '../../../util/log';
import * as actions from '../actions/profiles';
import { clearLastActiveProfile, setNextProfile } from '../actions/settings';
import { activeProfile, lastActiveProfileForGame, profileById } from '../selectors';
import { IProfile } from '../types/IProfile';

export function profilePath(profile: IProfile): string {
  return path.join(getVortexPath('userData'), profile.gameId, 'profiles', profile.id);
}

async function removeProfileImpl(api: IExtensionApi, profile: IProfile) {
  api.store.dispatch(actions.willRemoveProfile(profile.id));
  const state = api.getState();
  const currentProfile = activeProfile(state);
  const gameMode = currentProfile?.gameId;

  if (profile.id === currentProfile?.id) {
    api.store.dispatch(setNextProfile(undefined));
  }
  const doRemoveProfile = () => {
    api.store.dispatch(actions.removeProfile(profile.id));

    if (gameMode !== undefined) {
      // It's possible that this is the last active profile
      //  for this game - we need to remove the last active
      //  game entry.
      const lastActiveProfileId = lastActiveProfileForGame(state, gameMode);
      if (profile.id === lastActiveProfileId) {
        api.store.dispatch(clearLastActiveProfile(gameMode));
      }
    }
  };
  return fs.removeAsync(profilePath(state.persistent.profiles[profile.id]))
    .then(() => doRemoveProfile())
    .catch(err => (err.code === 'ENOENT')
      ? doRemoveProfile() // Profile path is already missing, that's fine.
      : api.showErrorNotification('Failed to remove profile',
        err, { allowReport: err.code !== 'EPERM' }));

}

let removeProfilePP: (profile: IProfile) => void;

export function removeProfile(api: IExtensionApi, profileId: string): boolean {
  const state = api.getState();
  const activity = state.session.base?.activity?.mods ?? [];
  const profile = profileById(state, profileId);

  if (activity.includes('deployment')) {
    log('info', 'refusing to remove profile during deployment');
    return false;
  }

  if (profile === undefined) {
    const err = new Error('Invalid profile');
    err['profileId'] = profileId;
    throw err;
  }

  if (removeProfilePP === undefined) {
    removeProfilePP = api.withPrePost('remove-profile', (profileInner: IProfile) =>
      Bluebird.resolve(removeProfileImpl(api, profileInner)));
  }

  removeProfilePP(profile);
}
