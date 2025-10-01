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
import type { IPresetStep, IPresetStepSetGame } from '../../types/IPreset';
import { IGameStored, IState } from '../../types/IState';
import { relaunch } from '../../util/commandLine';
import { ProcessCanceled, ServiceTemporarilyUnavailable, SetupError, TemporaryError, UserCanceled } from '../../util/CustomErrors';
import { IRegisteredExtension } from '../../util/ExtensionManager';
import * as fs from '../../util/fs';
import getVortexPath from '../../util/getVortexPath';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import onceCB from '../../util/onceCB';
import presetManager from '../../util/PresetManager';
import { discoveryByGame, gameById, installPathForGame, needToDeployForGame } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { batchDispatch, truthy } from '../../util/util';

import { IExtension } from '../extension_manager/types';
import { readExtensions } from '../extension_manager/util';
import { getGame } from '../gamemode_management/util/getGame';
import { ensureStagingDirectory } from '../mod_management/stagingDirectory';
import { purgeMods } from '../mod_management/util/deploy';
import { NoDeployment } from '../mod_management/util/exceptions';

import { forgetMod, removeProfile, setProfile, setProfileActivated, willRemoveProfile } from './actions/profiles';
import { clearLastActiveProfile, setCurrentProfile, setNextProfile } from './actions/settings';
import { profilesReducer } from './reducers/profiles';
import { settingsReducer } from './reducers/settings';
import transferSetupReducer from './reducers/transferSetup';
import { CorruptActiveProfile } from './types/Errors';
import { IProfile } from './types/IProfile';
import { IProfileFeature } from './types/IProfileFeature';
import Connector from './views/Connector';
import ProfileView from './views/ProfileView';
import TransferDialog from './views/TransferDialog';

import { STUCK_TIMEOUT } from './constants';
import { activeGameId, activeProfile, lastActiveProfileForGame, profileById } from './selectors';
import { syncFromProfile, syncToProfile } from './sync';

import Promise from 'bluebird';
import * as path from 'path';
import * as Redux from 'redux';
import { generate as shortid } from 'shortid';

const profileFiles: { [gameId: string]: Array<string | (() => PromiseLike<string[]>)> } = {};

const profileFeatures: IProfileFeature[] = [];

function profilePath(profile: IProfile): string {
  return path.join(getVortexPath('userData'), profile.gameId, 'profiles', profile.id);
}

function checkProfile(store: Redux.Store<any>, currentProfile: IProfile): Promise<void> {
  return fs.ensureDirAsync(profilePath(currentProfile));
}

function sanitizeProfile(store: Redux.Store<any>, profile: IProfile): void {
  const state: IState = store.getState();
  const batched = [];
  Object.keys(profile.modState || {}).forEach(modId => {
    if (getSafe(state.persistent.mods, [profile.gameId, modId], undefined) === undefined) {
      log('debug', 'removing info of missing mod from profile', {
        profile: profile.id,
        game: profile.gameId,
        modId });
      batched.push(forgetMod(profile.id, modId));
    }
  });
  batchDispatch(store, batched);
}

function refreshProfile(store: Redux.Store<any>, profile: IProfile,
                        direction: 'import' | 'export'): Promise<void> {
  log('debug', 'refresh profile', { profile, direction });
  if (profile === undefined || profile?.pendingRemove === true) {
    return Promise.resolve();
  }
  if ((profile.gameId === undefined) || (profile.id === undefined)) {
    return Promise.reject(new CorruptActiveProfile(profile));
  }
  return checkProfile(store, profile)
    .then(() => profilePath(profile))
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
      return Promise.all(profileFiles[gameId].map(iter => {
        return typeof(iter) === 'string'
          ? Promise.resolve([iter])
          : iter();
      }))
        .then(fileLists => [].concat(...fileLists))
        .then(filePaths => {
          if (direction === 'import') {
            return syncToProfile(
              currentProfilePath, filePaths,
              (error, detail, allowReport) =>
                showError(store.dispatch, error, detail, { allowReport }));
          } else {
            return syncFromProfile(
              currentProfilePath, filePaths,
              (error, detail, allowReport) =>
                showError(store.dispatch, error, detail, { allowReport }));
          }
        });
    })
    .catch((err: Error) => {
      // why are we catching here at all? shouldn't a failure here cancel the
      // entire operation?
      if (err instanceof UserCanceled) {
        return Promise.reject(err);
      }
      showError(store.dispatch, 'Failed to set profile', err);
    });
}

/**
 * activate the specified game (using the last active profile for that game).
 * Will ask the user if the game was never active (how would this happen?)
 *
 * @param {string} gameId
 */
function activateGame(store: ThunkStore<IState>, gameId: string): Promise<void> {
  const state: IState = store.getState();
  const gamePath = getSafe(state, ['settings', 'gameMode', 'discovered', gameId, 'path'], undefined);
  
  log('debug', 'activateGame called', { 
    gameId, 
    gamePath, 
    platform: process.platform,
    currentActiveProfile: state.settings.profiles.activeProfileId,
    nextProfile: state.settings.profiles.nextProfileId
  });
  
  if (gamePath === undefined) {
    log('error', 'game activation failed - game not discovered', { 
      gameId,
      discoveredGames: Object.keys(state.settings.gameMode.discovered || {})
    });
    
    store.dispatch(addNotification({
      type: 'warning',
      title: '{{gameId}} not enabled',
      message: 'Game no longer discovered. Please re-scan for games.',
      replace: {
        gameId,
      },
    }));
    
    log('info', 'unselecting profile because game no longer discovered', { gameId });
    store.dispatch(setNextProfile(undefined));
    return Promise.resolve();
  }

  log('info', 'activating game', { gameId, gamePath });

  const profileId = getSafe(state, ['settings', 'profiles', 'lastActiveProfile', gameId], undefined);
  const profile = getSafe(state, ['persistent', 'profiles', profileId], undefined);
  
  log('debug', 'profile lookup results', { 
    gameId, 
    profileId, 
    profileExists: profile !== undefined,
    profileGameId: profile?.gameId,
    allProfiles: Object.keys(state.persistent.profiles || {})
  });
  
  if ((profileId === undefined) || (profile === undefined)) {
    const profiles = getSafe(state, ['persistent', 'profiles'], []);
    const gameProfiles: IProfile[] = Object.keys(profiles)
      .filter((id: string) => profiles[id].gameId === gameId)
      .map((id: string) => profiles[id]);
      
    log('debug', 'no last active profile found, showing profile selection dialog', { 
      gameId, 
      availableProfiles: gameProfiles.length,
      profileNames: gameProfiles.map(p => p.name)
    });
    
    if (gameProfiles.length === 0) {
      log('error', 'no profiles found for game', { gameId });
      store.dispatch(addNotification({
        type: 'error',
        title: 'No profiles found',
        message: 'No profiles found for {{gameId}}. Please create a profile first.',
        replace: { gameId },
      }));
      return Promise.resolve();
    }
    
    return store.dispatch(showDialog('question', 'Choose profile', {
      text: 'Please choose the profile to use with this game',
      choices: gameProfiles.map((iter: IProfile, idx: number) =>
        ({ id: iter.id, text: iter.name, value: idx === 0 })),
    }, [ { label: 'Activate' } ]))
      .then((dialogResult: IDialogResult) => {
        if (dialogResult.action === 'Activate') {
          const selectedId = Object.keys(dialogResult.input).find(
            (id: string) => dialogResult.input[id]);
          
          log('info', 'user selected profile for activation', { 
            gameId, 
            selectedId, 
            profileName: gameProfiles.find(p => p.id === selectedId)?.name 
          });
          
          // Ensure the profile activation persists
          store.dispatch(setNextProfile(selectedId));
          
          // Also update the current profile to ensure persistence
          store.dispatch(setCurrentProfile(gameId, selectedId));
          
          log('debug', 'profile activation dispatched', { gameId, selectedId });
        } else {
          log('warn', 'user cancelled profile selection', { gameId });
        }
      })
      .catch(err => {
        log('error', 'error in profile selection dialog', { gameId, error: err.message });
        throw err;
      });
  } else {
    log('info', 'using last active profile', { gameId, profileId, profileName: profile.name });
    
    // Verify that game is still discovered and profile is valid
    const fbProfile = state.persistent.profiles?.[profileId];
    const discovery = state.settings.gameMode.discovered?.[fbProfile?.gameId];
    
    log('debug', 'verifying profile and game discovery', {
      gameId,
      profileId,
      profileGameId: fbProfile?.gameId,
      discoveryPath: discovery?.path,
      discoveryExists: discovery?.path !== undefined
    });
    
    if (discovery?.path !== undefined) {
      log('info', 'activating verified profile', { gameId, profileId });
      store.dispatch(setNextProfile(profileId));
      
      // Ensure the current profile is also set to maintain persistence
      store.dispatch(setCurrentProfile(gameId, profileId));
      
      log('debug', 'profile activation completed successfully', { 
        gameId, 
        profileId,
        currentState: {
          nextProfile: store.getState().settings.profiles.nextProfileId,
          lastActiveProfile: store.getState().settings.profiles.lastActiveProfile?.[gameId]
        }
      });
    } else {
      log('error', 'profile activation failed - game discovery invalid', { 
        gameId, 
        profileId, 
        discoveryPath: discovery?.path,
        profileGameId: fbProfile?.gameId
      });
      
      store.dispatch(addNotification({
        type: 'warning',
        title: 'Profile activation failed',
        message: 'Cannot activate profile - game discovery is invalid. Please re-scan for games.',
        replace: { gameId },
      }));
      
      store.dispatch(setNextProfile(undefined));
    }
    return Promise.resolve();
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

  const gameDiscovery =
    getSafe(state, ['settings', 'gameMode', 'discovered', profile.gameId], undefined);
  if (gameDiscovery?.path === undefined) {
    // can't deploy a game that hasn't been discovered
    return Promise.resolve();
  }

  let lastProgress: number = Date.now();

  const watchdog = setInterval(() => {
    if ((Date.now() - lastProgress) > STUCK_TIMEOUT) {
      api.store.dispatch(setProgress('profile', 'deploying',
                                     api.translate('Stuck? Please check your vortex.log file.'), 0));
    }
  }, 1000);

  return new Promise((resolve, reject) => {
    api.events.emit('deploy-mods', onceCB((err: Error) => {
      clearInterval(watchdog);
      if (err === null) {
        resolve();
      } else {
        reject(err);
      }
    }), profileId,
                    (text: string, percent: number) => {
                      lastProgress = Date.now();
                      api.store.dispatch(
                        setProgress('profile', 'deploying', text, percent));
                    });
  });
}

/* generates a profile change handler.
 * that is: it reacts to the "next profile" being changed, which triggers the
 * "active profile" being updated. "onFinishProfileSwitch" registers a callback
 * which will signal when the active profile has been updated, only then will the
 * next profile switch be allowed.
 */
function genOnProfileChange(api: IExtensionApi,
                            onFinishProfileSwitch: (callback: () => void) => void) {
  let finishProfileSwitchPromise: Promise<void> = Promise.resolve();
  const { store } = api;

  let cancelPromise: () => void;

  const invokeCancel = () => {
    if (cancelPromise !== undefined) {
      onFinishProfileSwitch(undefined);
      cancelPromise();
      cancelPromise = undefined;
    }
  };

  const cancelSwitch = () => {
    invokeCancel();
    store.dispatch(setCurrentProfile(undefined, undefined));
    store.dispatch(setNextProfile(undefined));
  };

  const confirmProfile = (gameId: string, current: string) => {
    store.dispatch(setCurrentProfile(gameId, current));
    if (current !== undefined) {
      store.dispatch(setProfileActivated(current));
    }
    const confirmPromise = cancelPromise;
    setTimeout(() => {
      if ((confirmPromise === cancelPromise) && (cancelPromise !== undefined)) {
        log('warn', 'active profile switch didn\'t get confirmed?');
        invokeCancel();
      }
    }, 2000);
  };

  return (prev: string, current: string) => {
    log('info', 'Profile switch initiated', { from: prev, to: current });
    finishProfileSwitchPromise.then(() => {
      const state: IState = store.getState();
      if (state.settings.profiles.nextProfileId !== current) {
        // cancel if there was another profile switch while we waited
        log('info', 'Profile switch canceled - another switch was queued', { 
          from: prev, 
          to: current, 
          nextProfileId: state.settings.profiles.nextProfileId 
        });
        return null;
      }

      if (state.settings.profiles.activeProfileId === current) {
        // also do nothing if we're actually resetting the nextprofile
        log('debug', 'Profile switch skipped - already active', { 
          from: prev, 
          to: current 
        });
        return null;
      }

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
        if ((discovery?.path === undefined)) {
          showError(store.dispatch,
                    'Game is no longer discoverable, please go to the games page and scan for, or '
          + 'manually select the game folder.',
                    profile.gameId, { allowReport: false });
          return Promise.reject(new ProcessCanceled('Game no longer discovered'));
        }
      }

      finishProfileSwitchPromise = new Promise<void>((resolve, reject) => {
        cancelPromise = resolve;
        onFinishProfileSwitch(() => {
          cancelPromise = undefined;
          resolve();
        });
      }).catch(err => {
        showError(store.dispatch, 'Profile switch failed', err);
        return Promise.resolve();
      })
      ;

      // IMPORTANT: After this point we expect an external signal to tell
      //   us when the active profile has been updated, otherwise we will not
      //   allow the next profile switch
      //   any error handler *has* to cancel this confirmation!

      let queue: Promise<void> = Promise.resolve();
      // emit an event notifying about the impending profile change.
      // every listener can return a cb returning a promise which will be
      // awaited before continuing.
      // It would be fun if we could cancel the profile change if one of
      // these promises is rejected but that would only work if we could roll back
      // changes that happened.
      const enqueue = (cb: () => Promise<void>) => {
        queue = queue.then(cb).catch(err => {
          log('error', 'error in profile-will-change handler', err.message);
          Promise.resolve();
        });
      };

      // changes to profile files are only saved back to the profile at this point
      queue = queue.then(() => refreshProfile(store, oldProfile, 'import'));
      const oldProfile = state.persistent.profiles[prev];

      api.events.emit('profile-will-change', current, enqueue);

      if (current === undefined) {
        log('info', 'switched to no profile');
        confirmProfile(undefined, undefined);
        return queue;
      }

      sanitizeProfile(store, profile);

      return queue.then(() => {
          log('info', 'Starting profile export phase', { from: prev, to: current });
          return refreshProfile(store, profile, 'export');
        })
        // ensure the old profile is synchronised before we switch, otherwise me might
        // revert some changes
        .tap(() => log('info', 'Starting deployment of previously active profile', { 
          profileId: prev, 
          from: prev, 
          to: current 
        }))
        .then(() => deploy(api, prev))
        .tap(() => log('info', 'Completed deployment of previously active profile', { 
          profileId: prev, 
          from: prev, 
          to: current 
        }))
        .tap(() => log('info', 'Starting deployment of next active profile', { 
          profileId: current, 
          from: prev, 
          to: current 
        }))
        .then(() => deploy(api, current))
        .tap(() => log('info', 'Completed deployment of next active profile', { 
          profileId: current, 
          from: prev, 
          to: current 
        }))
        .then(() => {
          const prof = profileById(api.store.getState(), current);
          if (prof === undefined) {
            return Promise.reject(
              new ProcessCanceled('Profile was deleted during deployment. '
                                  + 'Why would you do something like that???'));
          }

          api.store.dispatch(
            setProgress('profile', 'deploying', undefined, undefined));
          const gameId = profile !== undefined ? profile.gameId : undefined;
          log('info', 'switched to profile', { gameId, current });
          
          // Show success notification for profile switch
          if (profile !== undefined) {
            api.sendNotification({
              type: 'success',
              message: api.translate('Successfully switched to profile "{{profileName}}"', 
                { replace: { profileName: profile.name } }),
              displayMS: 3000,
            });
          }
          
          confirmProfile(gameId, current);
          return null;
        });
    })
      .catch(ProcessCanceled, err => {
        log('warn', 'Profile switch canceled due to ProcessCanceled', { 
          from: prev, 
          to: current, 
          error: err.message 
        });
        cancelSwitch();
        showError(store.dispatch, 'Failed to set profile', err.message,
                  { allowReport: false });
      })
      .catch(SetupError, err => {
        // For setup errors (like NoDeployment), we should be more careful
        // Only confirm the profile if it's a non-critical setup error
        log('error', 'Profile switch encountered setup error', { 
          from: prev, 
          to: current, 
          error: err.message,
          errorType: err.constructor.name 
        });
        
        // Check if this is a critical error that should cancel the switch
        const isCriticalError = err.message.includes('NoDeployment') === false;
        
        if (isCriticalError) {
          log('warn', 'Canceling profile switch due to critical setup error', { 
            from: prev, 
            to: current, 
            error: err.message 
          });
          cancelSwitch();
        } else {
          // Only for non-critical errors, allow the switch to complete
          const state = store.getState();
          const currentProfile = state.persistent.profiles[current];
          const profileGameId = currentProfile !== undefined ? currentProfile.gameId : undefined;
          log('info', 'Completing profile switch despite non-critical setup error', { 
            from: prev, 
            to: current, 
            profileGameId,
            error: err.message 
          });
          confirmProfile(profileGameId, current);
        }
        
        showError(store.dispatch, 'Failed to set profile', err.message,
                  { allowReport: false });
      })
      .catch(CorruptActiveProfile, (err) => {
        // AFAICT the only way for this error to pop up is when upgrading from
        //  an ancient version of Vortex which probably had a bug in it which we
        //  fixed a long time ago. Corrupt profiles are automatically removed by
        //  our verifiers and the user will just have to create a new profile for
        //  their game - not much we can do to help him with that.
        log('error', 'Profile switch failed due to corrupt active profile', { 
          from: prev, 
          to: current, 
          error: err.message 
        });
        cancelSwitch();
        showError(store.dispatch, 'Failed to set profile', err, { allowReport: false });
      })
      .catch(UserCanceled, () => {
        log('info', 'Profile switch canceled by user', { from: prev, to: current });
        cancelSwitch();
      })
      .catch(err => {
        log('error', 'Profile switch failed with unexpected error', { 
          from: prev, 
          to: current, 
          error: err.message,
          stack: err.stack 
        });
        cancelSwitch();
        showError(store.dispatch, 'Failed to set profile', err);
      });
  };
}

function manageGameDiscovered(api: IExtensionApi, gameId: string) {
  const profileId = shortid();
  // initialize the staging directory.
  // It's not great that this is here, the code would better fit into mod_management
  // but I'm not entirely sure what could happen if it's not initialized right away.
  // Since the dir has to be tagged we can't just sprinkle "ensureDir" anywhere we want
  // to access it.
  return ensureStagingDirectory(api, undefined, gameId)
    .then(() => {
      log('info', 'user managing game for the first time', { gameId });
      api.store.dispatch(setProfile({
        id: profileId,
        gameId,
        name: 'Default',
        modState: {},
        lastActivated: undefined,
      }));
      api.store.dispatch(setNextProfile(profileId));
    })
    .catch(err => {
      const instPath = installPathForGame(api.store.getState(), gameId);
      api.showErrorNotification('The game location doesn\'t exist or isn\'t writeable',
                                err, {
                                  allowReport: false,
                                  message: instPath,
                                });
    });
}

function manageGameUndiscovered(api: IExtensionApi, gameId: string): Promise<void> {
  let state: IState = api.store.getState();
  const knownGames = state.session.gameMode.known;
  const gameStored = knownGames.find(game => game.id === gameId);

  if (gameStored === undefined) {
    const extension = state.session.extensions.available.find(ext =>
      (ext?.gameId === gameId) || (ext.name === gameId));
    if (extension === undefined) {
      throw new ProcessCanceled(`Invalid game id "${gameId}"`);
    }

    // Get the game name for better user messaging
    const gameName = extension.gameName || extension.name.replace(/^Game: /, '') || 'this game';
    
    return api.showDialog('question', 'Game Support Not Installed', {
      text: 'Support for {{gameName}} is provided through a community extension that is not included with the main Vortex application. '
        + 'To manage mods for {{gameName}}, you need to download and install this extension.',
      parameters: {
        gameName
      }
    }, [
      { label: 'Cancel' },
      {
        label: 'Download Extension', action: () => {
          // Only show the blocking UI for non-game extensions
          if (extension.type !== 'game') {
            api.store.dispatch(setUIBlocker(
              'installing-game', 'download',
              'Installing Game, Vortex will restart upon completion.', true));
          } else {
            // For game extensions, show a non-blocking notification instead
            api.sendNotification({
              id: 'installing-game-extension',
              type: 'activity',
              message: 'Installing game extension...',
              displayMS: 5000,
            });
          }

          // Add timeout to prevent hanging on authentication
          let authTimeout: NodeJS.Timeout | null = null;
          let isCompleted = false;

          const cleanup = () => {
            if (authTimeout) {
              clearTimeout(authTimeout);
              authTimeout = null;
            }
            if (!isCompleted) {
              isCompleted = true;
              // Only clear the UI blocker for non-game extensions
              if (extension.type !== 'game') {
                api.store.dispatch(clearUIBlocker('installing-game'));
              }
            }
          };

          authTimeout = setTimeout(() => {
            if (!isCompleted) {
              cleanup();
              api.showErrorNotification('Authentication timeout', 
                'The authentication process took too long. Please try again.', {
                  allowReport: false
                });
            }
          }, 35000); // Slightly longer timeout to let ensureLoggedIn handle its own timeout first

          return api.ext.ensureLoggedIn()
            .then(() => {
              if (authTimeout) {
                clearTimeout(authTimeout);
                authTimeout = null;
              }
              return api.emitAndAwait('install-extension', extension);
            })
            .then((results: boolean[]) => {
              if (results.includes(true)) {
                // Only restart for non-game extensions
                if (extension.type !== 'game') {
                  relaunch(['--game', gameId]);
                } else {
                  // For game extensions, show success notification
                  api.dismissNotification('installing-game-extension');
                  api.sendNotification({
                    type: 'success',
                    message: 'Game extension installed successfully! The game is now available in the Managed Games section.',
                    displayMS: 5000,
                  });
                  // Emit refresh-game-list with forceFullDiscovery=true to ensure game extensions are properly registered
                  api.events.emit('refresh-game-list', true);
                }
              }
              cleanup();
            })
            .catch(err => {

              cleanup();
              
              if (err instanceof UserCanceled) {
                return Promise.resolve();
              }

              const allowReport = !(err instanceof ProcessCanceled)
                && !(err instanceof ServiceTemporarilyUnavailable);
              api.showErrorNotification('Log-in failed', err, {
                id: 'failed-get-nexus-key',
                allowReport,
              });
            });
        },
      },
    ])
      .then(result => {
        // Wait for the installation to complete if the user clicked Download
        if (result.action === 'Download Extension') {
          // Return a promise that resolves when the installation completes
          return new Promise<void>((resolve) => {
            // The installation process will handle restarting Vortex
            // We just need to ensure the dialog doesn't resolve prematurely
            setTimeout(resolve, 100); // Small delay to allow restart to initiate
          });
        }
        return Promise.resolve();
      });
  }

  return api.showDialog('question', 'Game not discovered', {
    text: '"{{gameName}}" hasn\'t been automatically discovered, you will have to set the game '
      + 'folder manually.',
    parameters: {
      gameName: gameStored.name,
    }
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
      if (discovered?.path === undefined) {
        // this probably means the "manually set location" was canceled
        return Promise.resolve();
      }

      return manageGameDiscovered(api, gameId);
    })
    .catch(err => {
      if (!(err instanceof UserCanceled)
          && !(err instanceof ProcessCanceled)) {
        api.showErrorNotification('Failed to manage game', err);
      }
      return;
    });
}

function manageGame(api: IExtensionApi, gameId: string): Promise<void> {
  const state: IState = api.store.getState();
  const discoveredGames = state.settings.gameMode?.discovered || {};
  const profiles = state.persistent.profiles || {};

  if (getSafe(discoveredGames, [gameId, 'path'], undefined) !== undefined) {
    const profile = Object.values(profiles).find(prof => prof.gameId === gameId);
    if (profile !== undefined) {
      return activateGame(api.store, gameId);
    } else {
      return manageGameDiscovered(api, gameId);
    }
  } else {
    return manageGameUndiscovered(api, gameId);
  }
}

function removeProfileImpl(api: IExtensionApi, profileId: string) {
  const { store } = api;
  const state = api.getState();
  const { profiles } = state.persistent;
  log('info', 'user removing profile', { id: profileId });

  if (profiles[profileId] === undefined) {
    // nothing to do
    return Promise.resolve();
  }

  const currentProfile = activeProfile(state);

  store.dispatch(willRemoveProfile(profileId));
  if (profileId === currentProfile?.id) {
    store.dispatch(setNextProfile(undefined));
  }

  return fs.removeAsync(profilePath(profiles[profileId]))
    .catch(err => (err.code === 'ENOENT')
      ? Promise.resolve()
      : Promise.reject(err))
    .then(() => {
      const gameMode = profiles[profileId].gameId;
      const lastProfileId = lastActiveProfileForGame(state, gameMode);
      if (profileId === lastProfileId) {
        store.dispatch(clearLastActiveProfile(gameMode));
      }
      store.dispatch(removeProfile(profileId));
    })
    .catch(err => {
      this.context.api.showErrorNotification('Failed to remove profile',
                                             err, { allowReport: err.code !== 'EPERM' });
    });
}

function removeMod(api: IExtensionApi, gameId: string, modId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    api.events.emit('remove-mod', gameId, modId, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function unmanageGame(api: IExtensionApi, gameId: string, gameName?: string): Promise<void> {
  const state = api.getState();
  const game = getGame(gameId);
  const { mods, profiles } = state.persistent;
  const profileIds = Object.keys(profiles)
    .filter(profileId => profiles[profileId]?.gameId === gameId);

  api.events.emit('analytics-track-event', 'Games', 'Stop managing', gameId);

  let message: string;

  if ((profileIds.length > 1)
      || (profiles[profileIds[0]]?.name !== 'Default')) {
    message = profileIds.map(id => profiles[id]?.name || id).join('\n');
  }

  return api.showDialog('info', 'Confirm Removal', {
    bbcode: 'This will uninstall all mods managed by vortex and delete all profiles '
          + 'for "{{gameName}}", '
          + 'potentially including associated savegames, ini files and everything else Vortex '
          + 'stores per-profile.'
          + '[br][/br][br][/br]'
          + '[style=dialog-danger-text]This is irreversible and we will not warn again, continue only if '
          + 'you\'re sure this is what you want![/style]',
    message,
    parameters: {
      gameName: game?.name ?? gameName ?? api.translate('<Missing game>'),
    },
  }, [
    { label: 'Cancel' },
    { label: 'Delete profiles' },
  ])
    .then(result => {
      if (result.action === 'Delete profiles') {
        return purgeMods(api, gameId, true)
          .then(() => Promise.map(Object.keys(mods[gameId] ?? {}),
                                  modId => removeMod(api, gameId, modId)))
          .then(() => Promise.map(profileIds, profileId => removeProfileImpl(api, profileId)))
          .then(() => Promise.resolve())
          .catch(UserCanceled, () => Promise.resolve())
          .catch(err => {
            const isSetupError = (err instanceof NoDeployment) || (err instanceof TemporaryError);
            if (isSetupError) {
              api.showDialog('error', 'Failed to purge', {
                text: 'Failed to purge mods deployed for this game. To ensure there are no '
                  + 'leftovers before Vortex stops managing the game, please solve any '
                  + 'setup problems for the game first.',
              }, [
                { label: 'Close' },
              ]);
              return;
            } else {
              api.showErrorNotification('Failed to stop managing game', err, {
                allowReport: !(err instanceof ProcessCanceled),
              });
            }
          });
      } else {
        return Promise.resolve();
      }
    });
}

function addDescriptionFeature() {
  profileFeatures.push({
    id: 'profile-description',
    type: 'text',
    icon: 'edit',
    label: 'Description',
    description: 'Describe your profile',
    supported: () => true,
    namespace: 'default',
  });
}

function checkOverridden(api: IExtensionApi, gameId: string): Promise<void> {
  const state = api.getState();
  const { disabled } = state.session.gameMode;

  if (disabled[gameId] === undefined) {
    return Promise.resolve();
  }

  return api.showDialog('question', 'Game disabled', {
    text: 'A different game extension is currently managing that game directory.',
    message: gameById(state, disabled[gameId]).name,
  }, [
    { label: 'Cancel' },
  ])
    .then(() => Promise.reject(new UserCanceled()));
}

function init(context: IExtensionContext): boolean {
  context.registerReducer(['persistent', 'profiles'], profilesReducer);
  context.registerReducer(['settings', 'profiles'], settingsReducer);
  context.registerReducer(['session', 'profileTransfer'], transferSetupReducer);

  context.registerMainPage('profile', 'Profiles', ProfileView, {
    hotkey: 'P',
    group: 'global',
    visible: () => (activeGameId(context.api.store.getState()) !== undefined)
      && (context.api.store.getState().settings.interface.profilesVisible),
    props: () => ({ features: profileFeatures }),
  });

  context.registerAction('game-unmanaged-buttons', 50, 'activate', {
    noCollapse: true,
  }, 'Manage',
                         (instanceIds: string[]) => {
                           const gameId = instanceIds[0];

                           context.api.events.emit(
                             'analytics-track-event', 'Games', 'Start managing', gameId,
                           );

                           context.api.emitAndAwait('discover-game', gameId)
                             .then(() => checkOverridden(context.api, gameId))
                             .then(() => {
                               const state = context.api.getState();
                               const manageFunc = (state.settings.gameMode.discovered[gameId]?.path !== undefined)
                                 ? manageGameDiscovered
                                 : manageGameUndiscovered;

                               manageFunc(context.api, gameId);
                             })
                             .catch(err => {
                               if (!(err instanceof UserCanceled)) {
                                 context.api.showErrorNotification('Failed to manage game', err);
                               }
                             });
                         });

  context.registerAction('game-managed-buttons', 50, 'activate', {
    noCollapse: true,
  }, 'Activate', (instanceIds: string[]) => {

    const gameId = instanceIds[0];
    const state = context.api.getState();

    let gameVersion = '';
    let extensionVersion = '';
    let gameProfileCount = 1;

    if (gameId) {
      const game = getGame(gameId);          
      extensionVersion = game.version;
      game.getInstalledVersion(discoveryByGame(state, gameId)).then((value) => {        gameVersion = value;      });
      gameProfileCount = Object.values(state.persistent.profiles).filter((profile) => { return profile.gameId === gameId }).length;
    }

    const profileData = {
      gameId: gameId,
      gameVersion: gameVersion,
      extensionVersion: extensionVersion,
      gameProfileCount: gameProfileCount
    };

    log('info', 'activate profile', profileData);            

    context.api.events.emit( 'analytics-track-event', 'Games', 'Activate' , gameId, profileData);

    checkOverridden(context.api, gameId)
      .then(() => {
        activateGame(context.api.store, gameId);
      })
      .catch(err => {
        if (!(err instanceof UserCanceled)) {
          context.api.showErrorNotification('Failed to activate game', err);
        }
      });
  }, (instanceIds: string[]) =>
    activeGameId(context.api.getState()) !== instanceIds[0],
  );

  context.registerProfileFile =
    (gameId: string, filePath: string | (() => PromiseLike<string[]>)) => {
      if (profileFiles[gameId] === undefined) {
        profileFiles[gameId] = [];
      }
      profileFiles[gameId].push(filePath);
    };

  context.registerAction('game-managed-buttons', 150, 'delete', {},
                         context.api.translate('Stop Managing'),
                         (instanceIds: string[]) => { unmanageGame(context.api, instanceIds[0]); });

  context.registerProfileFeature =
      (featureId: string, type: string, icon: string, label: string, description: string,
       supported: () => boolean, extPath?: string, extInfo?: Partial<IRegisteredExtension>) => {
        profileFeatures.push({
          id: featureId,
          type,
          icon,
          label,
          description,
          supported,
          namespace: extInfo?.namespace,
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

  context.registerAPI('unmanageGame', (gameId: string, gameName?: string) =>
    unmanageGame(context.api, gameId, gameName), {});

  // ensure the current profile is always set to a valid value on startup and
  // when changing the game mode
  context.once(() => {
    const store = context.api.store;

    addDescriptionFeature();

    // Serialize activation requests to avoid races during rapid installs
    const activationQueue: string[] = [];
    let isActivating = false;

    function onceProfileDidChange(): Promise<void> {
      return new Promise<void>((resolve) => {
        const handler = (current: string) => {
          context.api.events.removeListener('profile-did-change', handler as any);
          resolve();
        };
        context.api.events.on('profile-did-change', handler as any);
      });
    }

    async function processNext() {
      if (isActivating || activationQueue.length === 0) {
        return;
      }
      isActivating = true;
      const nextGameId = activationQueue.shift();
      try {
        activateGame(store, nextGameId);
        await onceProfileDidChange();
      } finally {
        isActivating = false;
        // Continue with next queued activation
        if (activationQueue.length > 0) {
          processNext();
        }
      }
    }

    context.api.events.on('activate-game', (gameId: string) => {
      activationQueue.push(gameId);
      processNext();
    });

    // promise used to ensure a new profile switch can't be started before the last one
    // is complete
    let finishProfileSwitch: () => void;

    context.api.onStateChange(
      ['settings', 'profiles', 'nextProfileId'],
      genOnProfileChange(context.api, (callback: () => void) => finishProfileSwitch = callback));

    context.api.onStateChange(['settings', 'profiles', 'activeProfileId'],
                              (prev: string, current: string) => {
                                context.api.events.emit('profile-did-change', current);
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
                                if (commandLine.profile !== undefined) {
                                  const profile: IProfile = getSafe(state,
                                                                    ['persistent', 'profiles', commandLine.profile], undefined);

                                  if (profile !== undefined) {
                                    context.api.store.dispatch(setNextProfile(profile.id));
                                  } else {
                                    log('warn', 'profile cmdline argument detected - but profile is missing',
                                        commandLine.profile);
                                  }
                                } else if (commandLine.game !== undefined) {
          // the game specified on the command line may be a game id or an extension
          // name, because at the time we download an extension we don't actually know
          // the game id yet.

                                  readExtensions(false)
                                    .then((extensions: { [extId: string]: IExtension }) => {
                                      const extPathLookup = Object.values(extensions)
                                        .reduce((prevExt, ext) => {
                                          if (ext.path !== undefined) {
                                            prevExt[ext.path] = ext.name;
                                          }
                                          return prevExt;
                                        }, {});

                                      const game = current.find(iter =>
                                        (iter.id === commandLine.game)
                || (extPathLookup[iter.extensionPath] === commandLine.game));

                                      if (game !== undefined) {
                                        manageGame(context.api, game.id);
                                      } else {
                                        log('warn', 'game specified on command line not found', {
                                          game: commandLine.game,
                                        });
                                      }
                                    });
                                }
                              });

    context.api.onStateChange(
      ['persistent', 'profiles'],
      (prev: { [profileId: string]: IProfile }, current: { [profileId: string]: IProfile }) => {
        Object.keys(current).forEach(profileId => {
          if (prev[profileId] === current[profileId]) {
            return;
          }

          const profile = current[profileId];

          const prevState = getSafe(prev, [profileId, 'modState'], {});
          const currentState = getSafe(current, [profileId, 'modState'], {});

          if (prevState !== currentState) {
            const mods = context.api.getState().persistent.mods[profile.gameId];
            Object.keys(currentState)
              .forEach(modId => {
                const isEnabled = getSafe(currentState, [modId, 'enabled'], false);
                const wasEnabled = getSafe(prevState, [modId, 'enabled'], false);

                if ((isEnabled !== wasEnabled) && (mods[modId] !== undefined)) {
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

      const initProfile = activeProfile(state);
      refreshProfile(store, initProfile, 'import')
        .then(() => {
          const { commandLine } = state.session.base;
          if ((initProfile !== undefined)
                && (commandLine?.profile === undefined)
                && (commandLine?.game === undefined)) {
            context.api.events.emit('profile-did-change', initProfile.id);
          }
          return null;
        })
        .catch((err: Error) => {
          if (!(err instanceof UserCanceled)) {
            const allowReport = !(err instanceof CorruptActiveProfile);
            showError(store.dispatch, 'Failed to set profile', err, { allowReport });
          }
          store.dispatch(setCurrentProfile(undefined, undefined));
          store.dispatch(setNextProfile(undefined));
          if (finishProfileSwitch !== undefined) {
            finishProfileSwitch();
          }
        });

      const { activeProfileId, nextProfileId } = state.settings.profiles;
      if (nextProfileId !== activeProfileId) {
        log('warn', 'started with a profile change in progress');

        // ensure the new profile is valid and the corresponding game is
        // discovered
        if (truthy(activeProfileId)
          && (state.persistent.profiles[activeProfileId] !== undefined)) {
          const profile = state.persistent.profiles[activeProfileId];
          const discovery = discoveryByGame(state, profile.gameId);
          if (discovery?.path !== undefined) {
            store.dispatch(setNextProfile(activeProfileId));
          } else {
            store.dispatch(setNextProfile(undefined));
          }
        } else {
          store.dispatch(setNextProfile(undefined));
        }
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
  
    presetManager.on('setgame', (step: IPresetStep): Promise<void> => {
      return manageGame(context.api, (step as IPresetStepSetGame).game)
        .then(() => context.api.ext.awaitProfileSwitch?.())
        .then(() => null);
    });
  });

  context.registerDialog('profile-transfer-connector', Connector);
  context.registerDialog('transfer-dialog-settings', TransferDialog);

  return true;
}

export default init;
