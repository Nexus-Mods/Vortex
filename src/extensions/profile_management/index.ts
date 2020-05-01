/**
 * Manages profiles
 *
 * New API:
 *  registerProfileFile(gameId: string, filePath: string) - registers a file to be
 *    included in the profile so it gets stored in the profile and switched when the
 *    profile gets changed
 * State:
 *   settings.profiles.activeProfileId: string - currently active profile id
 *   persistent.profiles: { [gameId: string]: { [profileId: string]: IProfile } } -
 *      dictionary of all profiles
 * Actions:
 *   setProfile(gameId: string, profile: IProfile) - adds a new profile or changes an existing one
 *   setNextProfile(gameId: string, profileId: string) - activates a profile
 *   setModEnabled(gameId: string, profileId: string, modId: string, enabled: boolean) -
 *      enables or disables a mod in the current profile
 */

import { addNotification, IDialogResult, showDialog } from '../../actions/notifications';

import { clearUIBlocker, setProgress, setUIBlocker } from '../../actions/session';
import { IExtensionApi, IExtensionContext, ThunkStore } from '../../types/IExtensionContext';
import { IGameStored, IState } from '../../types/IState';
import { relaunch } from '../../util/commandLine';
import { ProcessCanceled, SetupError, UserCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import onceCB from '../../util/onceCB';
import { installPathForGame, needToDeployForGame } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';
import { getVortexPath } from '../../util/api';

import { IExtension } from '../extension_manager/types';
import { readExtensions } from '../extension_manager/util';
import { getGame } from '../gamemode_management/util/getGame';

import { forgetMod, setProfile, setProfileActivated } from './actions/profiles';
import { setCurrentProfile, setNextProfile } from './actions/settings';
import { profilesReducer } from './reducers/profiles';
import { settingsReducer } from './reducers/settings';
import transferSetupReducer from './reducers/transferSetup';
import { CorruptActiveProfile } from './types/Errors';
import { IProfile } from './types/IProfile';
import { IProfileFeature } from './types/IProfileFeature';
import Connector from './views/Connector';
import ProfileView from './views/ProfileView';
import TransferDialog from './views/TransferDialog';

import { activeGameId, activeProfile, lastActiveProfileForGame, profileById } from './selectors';
import { syncFromProfile, syncToProfile } from './sync';

import Promise from 'bluebird';
import * as path from 'path';
import * as Redux from 'redux';
import { generate as shortid } from 'shortid';

const profileFiles: { [gameId: string]: string[] } = {};

const profileFeatures: IProfileFeature[] = [];

function profilePath(store: Redux.Store<any>, profile: IProfile): string {
  return path.join(getVortexPath('userData'), profile.gameId, 'profiles', profile.id);
}

function checkProfile(store: Redux.Store<any>, currentProfile: IProfile): Promise<void> {
  return fs.ensureDirAsync(profilePath(store, currentProfile));
}

function sanitizeProfile(store: Redux.Store<any>, profile: IProfile): void {
  const state: IState = store.getState();
  Object.keys(profile.modState || {}).forEach(modId => {
    if (getSafe(state.persistent.mods, [profile.gameId, modId], undefined) === undefined) {
      log('debug', 'removing info of missing mod from profile', {
        profile: profile.id,
        game: profile.gameId,
        modId });
      store.dispatch(forgetMod(profile.id, modId));
    }
  });
}

function refreshProfile(store: Redux.Store<any>, profile: IProfile,
                        direction: 'import' | 'export'): Promise<void> {
  log('debug', 'refresh profile', profile);
  if (profile === undefined) {
    return Promise.resolve();
  }
  if ((profile.gameId === undefined) || (profile.id === undefined)) {
    return Promise.reject(new CorruptActiveProfile(profile));
  }
  return checkProfile(store, profile)
      .then(() => profilePath(store, profile))
      .then((currentProfilePath: string) => {
        // if this is the first sync, we assume the files on disk belong
        // to the profile that was last active in Vortex. This could only be
        // false if the profile was somehow changed before without a
        // syncFromProfile happening. Of course if the profile was never
        // loaded then it has no copies of the files but that if fine.
        const gameId = profile.gameId;
        if (profileFiles[gameId] === undefined) {
          return Promise.resolve();
        }
        if (direction === 'import') {
          return syncToProfile(currentProfilePath, profileFiles[gameId],
            (error, detail, allowReport) =>
              showError(store.dispatch, error, detail, { allowReport }));
        } else {
          return syncFromProfile(currentProfilePath, profileFiles[gameId],
            (error, detail, allowReport) =>
              showError(store.dispatch, error, detail, { allowReport }));
        }
      })
      .catch((err: Error) => {
        showError(store.dispatch, 'Failed to set profile', err);
      })
      ;
}

/**
 * activate the specified game (using the last active profile for that game).
 * Will ask the user if the game was never active (how would this happen?)
 *
 * @param {string} gameId
 */
function activateGame(store: ThunkStore<IState>, gameId: string) {
  log('info', 'activating game', { gameId });
  const state: IState = store.getState();
  if (getSafe(state, ['settings', 'gameMode', 'discovered', gameId, 'path'], undefined)
      === undefined) {
    store.dispatch(addNotification({
      type: 'warning',
      title: '{{gameId}} not enabled',
      message: 'Game no longer discovered',
      replace: {
        gameId,
      },
    }));
    log('info', 'unselecting profile because game no longer discovered', { gameId });
    store.dispatch(setNextProfile(undefined));
    return;
  }

  const profileId = getSafe(state, ['settings', 'profiles', 'lastActiveProfile', gameId],
    undefined);
  const profile = getSafe(state, ['persistent', 'profiles', profileId], undefined);
  if ((profileId === undefined) || (profile === undefined)) {
    const profiles = getSafe(state, ['persistent', 'profiles'], []);
    const gameProfiles: IProfile[] = Object.keys(profiles)
      .filter((id: string) => profiles[id].gameId === gameId)
      .map((id: string) => profiles[id]);
    store.dispatch(showDialog('question', 'Choose profile', {
      text: 'Please choose the profile to use with this game',
      choices: gameProfiles.map((iter: IProfile, idx: number) =>
        ({ id: iter.id, text: iter.name, value: idx === 0 })),
    }, [ { label: 'Activate' } ]))
      .then((dialogResult: IDialogResult) => {
        if (dialogResult.action === 'Activate') {
          const selectedId = Object.keys(dialogResult.input).find(
            (id: string) => dialogResult.input[id]);
          log('info', 'user selected profile', { selectedId });
          store.dispatch(setNextProfile(selectedId));
        }
      });
  } else {
    log('info', 'using last active profile', { profileId });
    store.dispatch(setNextProfile(profileId));
  }
}

function deploy(api: IExtensionApi, profileId: string): Promise<void> {
  const state: IState = api.store.getState();
  if ((profileId === undefined) || (state.persistent.profiles[profileId] === undefined)) {
    return Promise.resolve();
  }

  const profile = profileById(state, profileId);
  if ((profileId === lastActiveProfileForGame(state, profile.gameId))
      && !needToDeployForGame(state, profile.gameId)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    api.events.emit('deploy-mods', onceCB((err: Error) => {
        if (err === null) {
          resolve();
        } else {
          reject(err);
        }
      }), profileId,
      (text: string, percent: number) => {
        api.store.dispatch(
          setProgress('profile', 'deploying', text, percent));
      });
  });
}

function genOnProfileChange(api: IExtensionApi,
                            onFinishProfileSwitch: (callback: () => void) => void) {
  let finishProfileSwitchPromise: Promise<void> = Promise.resolve();
  const { store } = api;

  return (prev: string, current: string) => {
    finishProfileSwitchPromise.then(() => {
      const state: IState = store.getState();
      if (state.settings.profiles.nextProfileId !== current) {
        // cancel if there was another profile switch while we waited
        return null;
      }

      if (state.settings.profiles.activeProfileId === current) {
        // also do nothing if we're actually resetting the nextprofile
        return null;
      }

      finishProfileSwitchPromise = new Promise<void>((resolve, reject) => {
        onFinishProfileSwitch(resolve);
      }).catch(err => {
        showError(store.dispatch, 'Profile switch failed', err);
        return Promise.resolve();
      });

      const profile = state.persistent.profiles[current];
      if ((profile === undefined) && (current !== undefined)) {
        return Promise.reject(new Error('Tried to set invalid profile'));
      }

      if (profile !== undefined) {
        const { gameId } = profile;
        const game = getGame(gameId);
        if (game === undefined) {
          showError(store.dispatch,
            'Game no longer supported, please install the game extension',
            undefined, { message: profile.gameId, allowReport: false });
          return Promise.reject(new ProcessCanceled('Game no longer supported'));
        }

        const discovery = state.settings.gameMode.discovered[profile.gameId];
        if ((discovery === undefined) || (discovery.path === undefined)) {
          showError(store.dispatch,
            'Game is no longer discoverable, please go to the games page and scan for, or '
          + 'manually select the game folder.',
            profile.gameId, { allowReport: false });
          return Promise.reject(new ProcessCanceled('Game no longer discovered'));
        }
      }

      let queue: Promise<void> = Promise.resolve();
      // emit an event notifying about the impending profile change.
      // every listener can return a cb returning a promise which will be
      // awaited before continuing.
      // It would be fun if we could cancel the profile change if one of
      // these promises is rejected but that would only work if we could roll back
      // changes that happened.
      const enqueue = (cb: () => Promise<void>) => {
        queue = queue.then(cb).catch(err => Promise.resolve());
      };

      // changes to profile files are only saved back to the profile at this point
      queue = queue.then(() => refreshProfile(store, oldProfile, 'import'));
      const oldProfile = state.persistent.profiles[prev];

      api.events.emit('profile-will-change', current, enqueue);

      if (current === undefined) {
        log('info', 'switched to no profile');
        store.dispatch(setCurrentProfile(undefined, undefined));
        return queue;
      }

      sanitizeProfile(store, profile);
      return queue.then(() => refreshProfile(store, profile, 'export'))
        // ensure the old profile is synchronised before we switch, otherwise me might
        // revert some changes
        .then(() => deploy(api, prev))
        .then(() => deploy(api, current))
        .then(() => {
          api.store.dispatch(
            setProgress('profile', 'deploying', undefined, undefined));
          const gameId = profile !== undefined ? profile.gameId : undefined;
          log('info', 'switched to profile', { gameId, current });
          store.dispatch(setCurrentProfile(gameId, current));
          store.dispatch(setProfileActivated(current));
          return null;
        });
    })
      .catch(ProcessCanceled, err => {
        showError(store.dispatch, 'Failed to set profile', err.message,
          { allowReport: false });
        store.dispatch(setCurrentProfile(undefined, undefined));
        store.dispatch(setNextProfile(undefined));
      })
      .catch(SetupError, err => {
        showError(store.dispatch, 'Failed to set profile', err.message,
          { allowReport: false });
        store.dispatch(setCurrentProfile(undefined, undefined));
        store.dispatch(setNextProfile(undefined));
      })
      .catch(err => {
        showError(store.dispatch, 'Failed to set profile', err);
        store.dispatch(setCurrentProfile(undefined, undefined));
        store.dispatch(setNextProfile(undefined));
      });
  };
}

function manageGameDiscovered(api: IExtensionApi, gameId: string) {
  const profileId = shortid();
  const instPath = installPathForGame(api.store.getState(), gameId);
  fs.ensureDirWritableAsync(instPath, () => Promise.resolve())
    .then(() => {
      log('info', 'user managing game for the first time', { gameId });
      api.store.dispatch(setProfile({
        id: profileId,
        gameId,
        name: 'Default',
        modState: {},
      }));
      api.store.dispatch(setNextProfile(profileId));
    })
    .catch(err => {
      api.showErrorNotification('The game location doesn\'t exist or isn\'t writeable',
        err, {
        allowReport: false,
        message: instPath,
      });
    });
}

function manageGameUndiscovered(api: IExtensionApi, gameId: string) {
  let state: IState = api.store.getState();
  const knownGames = state.session.gameMode.known;
  const gameStored = knownGames.find(game => game.id === gameId);

  if (gameStored === undefined) {
    const extension = state.session.extensions.available.find(ext => ext.name === gameId);
    if (extension === undefined) {
      throw new ProcessCanceled(`Invalid game id "${gameId}"`);
    }

    api.showDialog('question', 'Game support not installed', {
      text: 'Support for this game is provided through an extension. To use it you have to '
        + 'download that extension and restart Vortex.',
    }, [
      { label: 'Cancel' },
      {
        label: 'Download', action: () => {
          api.store.dispatch(setUIBlocker('installing-game', 'download',
            'Installing Game, Vortex will restart upon completion.', true));

          api.emitAndAwait('install-extension', extension)
            .then(() => {
              relaunch(['--game', gameId]);
            })
            .finally(() => {
              api.store.dispatch(clearUIBlocker('installing-game'));
            });
        },
      },
    ]);
    return;
  }

  api.showDialog('question', 'Game not discovered', {
    text: 'This game hasn\'t been automatically discovered, you will have to set the game '
      + 'folder manually.',
  }, [
    { label: 'Continue' },
  ])
    .then(() => new Promise((resolve, reject) => {
      api.events.emit('manually-set-game-location', gameId, (err: Error) => {
        if (err !== null) {
          return reject(err);
        }
        return resolve();
      });
    }))
    .then(() => {
      state = api.store.getState();

      const discovered = state.settings.gameMode.discovered[gameId];
      if ((discovered === undefined) || (discovered.path === undefined)) {
        // this probably means the "manually set location" was canceled
        return Promise.resolve();
      }

      const profileId = shortid();
      const instPath = installPathForGame(state, gameId);
      return fs.ensureDirWritableAsync(instPath, () => Promise.resolve())
        .then(() => {
          log('info', 'user managing game for the first time', { gameId });
          api.store.dispatch(setProfile({
            id: profileId,
            gameId,
            name: 'Default',
            modState: {},
          }));
          api.store.dispatch(setNextProfile(profileId));
        })
        .catch(innerErr => {
          api.showErrorNotification(
            'The game location doesn\'t exist or isn\'t writeable',
            innerErr, {
            allowReport: false,
            message: instPath,
          });
        });
    })
    .catch(err => {
      if (!(err instanceof UserCanceled)
          && !(err instanceof ProcessCanceled)) {
        api.showErrorNotification('Failed to manage game', err);
      }
      return;
    });
}

function manageGame(api: IExtensionApi, gameId: string) {
  const state: IState = api.store.getState();
  const discoveredGames = state.settings.gameMode?.discovered || {};
  const profiles = state.persistent.profiles || {};

  if (getSafe(discoveredGames, [gameId, 'path'], undefined) !== undefined) {
    if (Object.values(profiles).find(prof => prof.gameId === gameId) !== undefined) {
      activateGame(api.store, gameId);
    } else {
      manageGameDiscovered(api, gameId);
    }
  } else {
    manageGameUndiscovered(api, gameId);
  }
}

function init(context: IExtensionContext): boolean {
  context.registerMainPage('profile', 'Profiles', ProfileView, {
    hotkey: 'P',
    group: 'global',
    visible: () => (activeGameId(context.api.store.getState()) !== undefined)
      && (context.api.store.getState().settings.interface.profilesVisible),
    props: () => ({ features: profileFeatures }),
  });

  context.registerReducer(['persistent', 'profiles'], profilesReducer);
  context.registerReducer(['settings', 'profiles'], settingsReducer);
  context.registerReducer(['session', 'profileTransfer'], transferSetupReducer);

  context.registerAction('game-discovered-buttons', 50, 'activate', {
    noCollapse: true,
  }, 'Manage',
    (instanceIds: string[]) => {
      manageGameDiscovered(context.api, instanceIds[0]);
  });

  context.registerAction('game-undiscovered-buttons', 50, 'activate', {
    noCollapse: true,
  }, 'Manage', (instanceIds: string[]) => {
    const gameId = instanceIds[0];
    manageGameUndiscovered(context.api, gameId);
  });

  context.registerAction('game-managed-buttons', 50, 'activate', {
    noCollapse: true,
  }, 'Activate', (instanceIds: string[]) => {
    activateGame(context.api.store, instanceIds[0]);
  }, (instanceIds: string[]) =>
      activeGameId(context.api.store.getState()) !== instanceIds[0],
  );

  context.registerProfileFile = (gameId: string, filePath: string) => {
    if (profileFiles[gameId] === undefined) {
      profileFiles[gameId] = [];
    }
    profileFiles[gameId].push(filePath);
  };

  context.registerProfileFeature =
      (featureId: string, type: string, icon: string, label: string, description: string,
       supported: () => boolean) => {
        profileFeatures.push({
          id: featureId,
          type,
          icon,
          label,
          description,
          supported,
        });
      };

  context.registerActionCheck('SET_NEXT_PROFILE', (state: IState, action: any) => {
    const { profileId } = action.payload;
    if (profileId === undefined) {
      // resetting must always work
      return undefined;
    }

    const profile = state.persistent.profiles[profileId];
    if (profile === undefined) {
      return 'Tried to activate unknown profile';
    }

    if (getSafe(state,
                ['settings', 'gameMode', 'discovered', profile.gameId, 'path'],
                undefined) === undefined) {
      return 'Can\'t enable profile because game wasn\'t discovered';
    }

    return undefined;
  });

  // ensure the current profile is always set to a valid value on startup and
  // when changing the game mode
  context.once(() => {
    const store = context.api.store;

    context.api.events.on('activate-game', (gameId: string) => {
      activateGame(store, gameId);
    });

    // promise used to ensure a new profile switch can't be started before the last one
    // is complete
    let finishProfileSwitch: () => void;

    context.api.onStateChange(
        ['settings', 'profiles', 'nextProfileId'],
        genOnProfileChange(context.api, (callback: () => void) => finishProfileSwitch = callback));

    context.api.onStateChange(['settings', 'profiles', 'activeProfileId'],
      (prev: string, current: string) => {
        context.api.events.emit('profile-did-change',
          current);
        if (finishProfileSwitch !== undefined) {
          finishProfileSwitch();
        }
      });

    let first = true;
    context.api.onStateChange(['session', 'gameMode', 'known'],
      (prev: IGameStored[], current: IGameStored[]) => {
        // known games should only be set once but better safe than sorry
        if (!first) {
          return;
        }
        first = false;
        const state: IState = store.getState();
        const { commandLine } = state.session.base;
        if (commandLine.game !== undefined) {
          // the game specified on the command line may be a game id or an extension
          // name, because at the time we download an extension we don't actually know
          // the game id yet.

          readExtensions(false)
            .then((extensions: { [extId: string]: IExtension }) => {
              const extPathLookup = Object.values(extensions)
                .reduce((prev, ext) => {
                  if (ext.path !== undefined) {
                    prev[ext.path] = ext.name;
                  }
                  return prev;
                }, {});

              const game = current.find(iter =>
                (iter.id === commandLine.game)
                || (extPathLookup[iter.extensionPath] === commandLine.game));

              if (game !== undefined) {
                manageGame(context.api, game.id);
              }
            });
        }
      });

    const initProfile = activeProfile(store.getState());
    refreshProfile(store, initProfile, 'import')
        .then(() => {
          if (initProfile !== undefined) {
            context.api.events.emit('profile-did-change', initProfile.id);
          }
          return null;
        })
        .catch((err: Error) => {
          showError(store.dispatch, 'Failed to set profile', err);
          store.dispatch(setCurrentProfile(undefined, undefined));
          store.dispatch(setNextProfile(undefined));
          if (finishProfileSwitch !== undefined) {
            finishProfileSwitch();
          }
        });

    context.api.onStateChange(
        ['persistent', 'profiles'], (prev: string, current: string) => {
          Object.keys(current).forEach(profileId => {
            if (prev[profileId] === current[profileId]) {
              return;
            }

            const prevState = getSafe(prev, [profileId, 'modState'], {});
            const currentState = getSafe(current, [profileId, 'modState'], {});

            if (prevState !== currentState) {
              Object.keys(currentState)
                .forEach(modId => {
                  const isEnabled = getSafe(currentState, [modId, 'enabled'], false);
                  const wasEnabled = getSafe(prevState, [modId, 'enabled'], false);

                  if (isEnabled !== wasEnabled) {
                    context.api.events.emit(
                        isEnabled ? 'mod-enabled' : 'mod-disabled', profileId,
                        modId);
                  }
                });
            }
          });
        });
    {
      const state: IState = store.getState();
      const { activeProfileId, nextProfileId } = state.settings.profiles;
      if (nextProfileId !== activeProfileId) {
        log('warn', 'started with a profile change in progress');
        store.dispatch(setNextProfile(activeProfileId || undefined));
      }

      // it's important we stop managing a game if it's no longer discovered
      // because that can cause problems all over the application
      if (truthy(activeProfileId)) {
        const profile = state.persistent.profiles[activeProfileId];
        if (profile === undefined) {
          return;
        }
        const discovery = state.settings.gameMode.discovered[profile.gameId];
        if ((discovery === undefined) || (discovery.path === undefined)) {
          log('info', 'active game no longer discovered, deactivate');
          store.dispatch(setNextProfile(undefined));
        }
      }
    }
  });

  context.registerDialog('profile-transfer-connector', Connector);
  context.registerDialog('transfer-dialog-settings', TransferDialog);

  return true;
}

export default init;
