import {
  backupPath, gameSettingsFiles, gameSupported, initGameSupport,
  ISettingsFile, mygamesPath, profilePath,
} from './util/gameSupport';

import Promise from 'bluebird';
import * as path from 'path';
import * as Redux from 'redux';
import { fs, log, selectors, types, util } from 'vortex-api';

function copyGameSettings(sourcePath: string, destinationPath: string,
                          files: ISettingsFile[], copyType: string): Promise<void> {
  return Promise.map(files, gameSetting => {
    let source = path.join(sourcePath, gameSetting.name);
    let destination = path.join(destinationPath, path.basename(gameSetting.name));
    const destinationOrig = destination;

    if (copyType.startsWith('Glo')) {
      source += '.base';
    } else if (copyType.endsWith('Glo')) {
      destination += '.base';
    }

    log('debug', 'copying profile inis', {source, destination});

    return fs.copyAsync(source, destination, { noSelfCopy: true })
      .catch(err => {
        if (gameSetting.optional) {
          return Promise.resolve();
        }
        switch (copyType) {
          // backup missing, create it now from global file
          case 'BacGlo': return fs.copyAsync(destination, source, { noSelfCopy: true });
          // profile ini missing, create it now from global file
          case 'ProGlo': return fs.copyAsync(destination, source, { noSelfCopy: true });
          // fatal error
          default: return Promise.reject(err);
        }
      })
      .then(() => copyType.endsWith('Glo')
        ? fs.copyAsync(source, destinationOrig, { noSelfCopy: true })
          .then(() =>  fs.copyAsync(source, destinationOrig + '.baked', { noSelfCopy: true }))
          .catch({ code: 'ENOENT' }, err =>
            gameSetting.optional ? Promise.resolve() : Promise.reject(err))
        : Promise.resolve());
  })
  .then(() => undefined);
}

function checkGlobalFiles(oldProfile: types.IProfile,
                          newProfile: types.IProfile): Promise<ISettingsFile[]> {
  let fileList: ISettingsFile[] = [];

  if ((oldProfile !== undefined) && gameSupported(oldProfile.gameId)) {
    fileList = fileList.concat(gameSettingsFiles(oldProfile.gameId,
                                                 mygamesPath(oldProfile.gameId)));
  }

  if ((newProfile !== undefined) && gameSupported(newProfile.gameId)) {
    fileList = fileList.concat(gameSettingsFiles(newProfile.gameId,
                                                 mygamesPath(newProfile.gameId)));
  }

  fileList = util.unique(fileList, item => item.name);

  return Promise.filter(fileList, file => file.optional
      ? Promise.resolve(false)
      : fs.statAsync(file.name).then(() => false).catch(() => true))
    .then((missingFiles: ISettingsFile[]) => {
      if (missingFiles.length > 0) {
        return Promise.resolve(missingFiles);
      } else {
        return Promise.resolve(null);
      }
    });
}

function updateLocalGameSettings(featureId: string, oldProfile: types.IProfile,
                                 newProfile: types.IProfile): Promise<void> {
  let copyFiles: Promise<void> = Promise.resolve();
  if (!!oldProfile
      && (oldProfile.features !== undefined)
      && oldProfile.features[featureId]
      && gameSupported(oldProfile.gameId)) {
    // revert game settings for game that was previously active
    const myGames = mygamesPath(oldProfile.gameId);
    const gameSettings = gameSettingsFiles(oldProfile.gameId, null);

    copyFiles = copyFiles
    // re-import global files to profile
    .then(() => ((oldProfile as any).pendingRemove === true)
        ? Promise.resolve()
        : copyGameSettings(myGames, profilePath(oldProfile), gameSettings, 'GloPro'))
    // restore backup
    .then(() => copyGameSettings(backupPath(oldProfile), myGames,
                                 gameSettings, 'BacGlo'));
  }

  if (!!newProfile
      && (newProfile.features !== undefined)
      && (newProfile.features[featureId])
      && gameSupported(newProfile.gameId)) {
    // install game settings for game&profile that will now be active
    const myGames = mygamesPath(newProfile.gameId);
    const gameSettings = gameSettingsFiles(newProfile.gameId, null);

    copyFiles = copyFiles
    // backup global files
    .then(() => copyGameSettings(myGames, backupPath(newProfile),
                                 gameSettings, 'GloBac'))
    // install profile files
    .then(() => copyGameSettings(profilePath(newProfile),
                                 myGames, gameSettings, 'ProGlo'));
  }

  return Promise.resolve(copyFiles);
}

function onSwitchGameProfile(store: Redux.Store<any>,
                             oldProfile: types.IProfile,
                             newProfile: types.IProfile)
                             : Promise<boolean> {
  return checkGlobalFiles(oldProfile, newProfile)
    .then(missingFiles => {
      if ((missingFiles !== undefined) && (missingFiles !== null)) {
        const fileList = missingFiles.map(fileName => `"${fileName.name}"`).join('\n');
        util.showError(store.dispatch, 'An error occurred activating profile',
          'Files are missing or not writeable:\n' + fileList + '\n\n' +
          'Some games need to be run at least once before they can be modded.',
          { allowReport: false });
        return false;
      }

      return updateLocalGameSettings('local_game_settings', oldProfile, newProfile)
        .then(() => true)
        .catch(util.UserCanceled, err => {
          log('info', 'User canceled game settings update', err);
          return false;
        })
        .catch((err) => {
          util.showError(store.dispatch,
            'An error occurred applying game settings',
            {
              error: err,
              'Old Game': (oldProfile || { gameId: 'none' }).gameId,
              'New Game': (newProfile || { gameId: 'none' }).gameId,
            });
          return false;
        });
    });
}

function onDeselectGameProfile(store: Redux.Store<any>,
                               profile: types.IProfile)
                               : Promise<boolean> {
  // It's possible for the profile to be undefined at this point
  //  if/when the user is not actively managing any games.
  if (!profile || !gameSupported(profile.gameId)) {
    return Promise.resolve(true);
  }
  return checkGlobalFiles(undefined, profile)
    .then(missingFiles => {
      if ((missingFiles !== undefined) && (missingFiles !== null)) {
        const fileList = missingFiles.map(fileName => `"${fileName.name}"`).join('\n');
        util.showError(store.dispatch, 'An error occurred activating profile',
          'Files are missing or not writeable:\n' + fileList + '\n\n' +
          'Some games need to be run at least once before they can be modded.',
          { allowReport: false });
        return false;
      }
    })
    .then(() => {
      const myGames = mygamesPath(profile.gameId);
      const gameSettings = gameSettingsFiles(profile.gameId, null);

      return copyGameSettings(myGames, profilePath(profile), gameSettings, 'GloPro')
        .then(() => true);
    });
}

function bakeSettings(api: types.IExtensionApi, profile: types.IProfile): Promise<void> {
  if (profile === undefined) {
    return Promise.resolve();
  }
  const state: types.IState = api.store.getState();
  const gameMods = state.persistent.mods[profile.gameId] || [];
  const mods = Object.keys(gameMods)
    .filter(key => util.getSafe(profile, ['modState', key, 'enabled'], false))
    .map(key => gameMods[key]);

  return util.sortMods(profile.gameId, mods, api)
    .then(sortedMods =>
      api.emitAndAwait('bake-settings', profile.gameId, sortedMods, profile));
}

function testGlobalFiles(api: types.IExtensionApi): Promise<types.ITestResult> {
  const gameMode = selectors.activeGameId(api.getState());
  if (!gameSupported(gameMode)) {
    return Promise.resolve(undefined);
  }
  let activeProfile = selectors.activeProfile(api.getState());
  if (activeProfile?.gameId == null) {
    return Promise.resolve(undefined);
  }

  return checkGlobalFiles(undefined, activeProfile)
    .then(missingFiles => {
      if (missingFiles == null || missingFiles.length === 0) {
        return Promise.resolve(undefined);
      }
      const fileList = missingFiles.map(fileName => `"${fileName.name}"`).join('\n');
      return Promise.resolve<types.ITestResult>({
        description: {
          short: 'Missing or not writeable game files',
          long: 'Files are missing or not writeable:\n' + fileList + '\n\n' +
          'Some games need to be run at least once before they can be modded.',
        },
        severity: 'warning',
        onRecheck: () => {
          const state = api.getState();
          activeProfile = selectors.activeProfile(state);
          return checkGlobalFiles(undefined, activeProfile)
            .then(recheckMissingFiles => (!recheckMissingFiles || recheckMissingFiles.length === 0))
              ? Promise.resolve(undefined)
              : Promise.resolve(testGlobalFiles(api));
        },
      });
    });
  };

function init(context: types.IExtensionContext): boolean {
  initGameSupport(context.api);

  context.registerProfileFeature(
    'local_game_settings', 'boolean', 'settings', 'Game Settings',
    'This profile has its own game settings',
    () => gameSupported(selectors.activeGameId(context.api.store.getState())));

  context.registerTest('check-global-files', 'gamemode-activated',
    () => testGlobalFiles(context.api));

  context.once(() => {
    const store: Redux.Store<types.IState> = context.api.store;
  
    context.api.events.on('profile-will-change',
                          (nextProfileId: string, enqueue: (cb: () => Promise<void>) => void) => {
        const state = store.getState();

        const oldProfileId = util.getSafe(state,
          ['settings', 'profiles', 'activeProfileId'], undefined);
        const oldProfile = state.persistent.profiles[oldProfileId];
        const newProfile = state.persistent.profiles[nextProfileId];

        const oldGameId = util.getSafe(oldProfile, ['gameId'], undefined);
        const newGameId = util.getSafe(newProfile, ['gameId'], undefined);

        if (oldGameId === newGameId) {
          enqueue(() => {
            return bakeSettings(context.api, oldProfile)
              .then(() => onSwitchGameProfile(store, oldProfile, newProfile)
              .then(() => bakeSettings(context.api, newProfile))
              .then(() => null));
          });
        } else {
          const lastActiveProfileId = newProfile !== undefined
            ? selectors.lastActiveProfileForGame(state, newProfile.gameId)
            : undefined;
          const lastActiveProfile = newProfile !== undefined
            ? state.persistent.profiles[lastActiveProfileId]
            : undefined;
          enqueue(() => bakeSettings(context.api, oldProfile)
            .then(() => onDeselectGameProfile(store, oldProfile))
            // all settings changes that have been made in the meantime still belong
            // to the last active profile. Just in case lastActiveProfile and newProfile are
            // different (which should *not* ever be the case) we need to bake these
            // settings now so they don't get overridden
            .tap(() => bakeSettings(context.api, lastActiveProfile))
            .then((success: boolean) => success && (newProfile !== undefined)
              ? onSwitchGameProfile(store, lastActiveProfile, newProfile)
              : Promise.resolve(success))
            .then(() => bakeSettings(context.api, newProfile))
            .catch(util.CycleError, err => {
              // this should be reported to the user elsewhere
              log('warn', 'settings couldn\'t be baked because mod rules contain cycles', err);
            })
            .catch(err => {
              const usercanceled = (err instanceof util.UserCanceled);
              context.api.showErrorNotification('failed to swap game settings file', err,
                { allowReport: !usercanceled });
            })
            .then(() => null));
        }
      });

  });
  return true;
}

export default init;
