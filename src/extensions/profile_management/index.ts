import { setCurrentProfile } from './actions/profiles';

import { IExtensionContext } from '../../types/IExtensionContext';

import { profilesReducer } from './reducers/profiles';
import ProfileView from './views/ProfileView';

import { log } from '../../util/log';

function checkProfile(store: Redux.Store<any>, currentProfile: string) {
  log('info', 'checkProfile called', { currentProfile });
  if (currentProfile === undefined) {
    // no profile set, find a fallback if possible
    if ('default' in store.getState().gameSettings.profiles) {
      store.dispatch(setCurrentProfile('default'));
    } else {
      let profiles = Object.keys(store.getState().gameSettings.profiles);
      if (profiles.length > 0) {
        store.dispatch(setCurrentProfile(profiles[0]));
      }
    }
  }
}

function init(context: IExtensionContext): boolean {
  context.registerMainPage('clone', 'Profiles', ProfileView);
  context.registerReducer(['gameSettings', 'profiles'], profilesReducer);

  // ensure the current profile is always set to a valid value on startup and
  // when changing the game mode 
  context.once(() => {
    checkProfile(context.api.store,
                 context.api.store.getState().gameSettings.profiles.currentProfile);
  });

  context.api.onStateChange(['gameSettings', 'profiles', 'current'],
    (prev: string, current: string) => {
      checkProfile(context.api.store, current);
  });

  return true;
}

export default init;
