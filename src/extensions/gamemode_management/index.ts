import { IExtensionContext } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import { IState } from '../../types/IState';
import LazyComponent from '../../util/LazyComponent';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { activeGameId } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';

import {IDownload} from '../download_management/types/IDownload';
import { setNextProfile } from '../profile_management/actions/settings';

import { addSearchPath } from './actions/settings';
import { discoveryReducer } from './reducers/discovery';
import { sessionReducer } from './reducers/session';
import { settingsReducer } from './reducers/settings';

import GameModeManager from './GameModeManager';

import ReduxProp from '../../util/ReduxProp';
import AddGameDialog from './views/AddGameDialog';
import {} from './views/GamePicker';
import HideGameIcon from './views/HideGameIcon';
import ProgressFooter from './views/ProgressFooter';
import {} from './views/Settings';

import { shell } from 'electron';

let gameModeManager: GameModeManager;

const extensionGames: IGame[] = [];

function init(context: IExtensionContext): boolean {
  const activity = new ReduxProp(context.api, [
    ['session', 'discovery'],
    ], (discovery: any) => discovery.running);

  context.registerMainPage('gamepad', 'Games', LazyComponent('./views/GamePicker', __dirname), {
    hotkey: 'G',
    group: 'global',
    activity,
  });
  context.registerSettings('Games', LazyComponent('./views/Settings', __dirname));
  context.registerReducer(['session', 'discovery'], discoveryReducer);
  context.registerReducer(['session', 'gameMode'], sessionReducer);
  context.registerReducer(['settings', 'gameMode'], settingsReducer);
  context.registerFooter('discovery-progress', ProgressFooter);

  context.registerGame = (game: IGame, extensionPath: string) => {
    game.pluginPath = extensionPath;
    extensionGames.push(game);
  };

  context.registerAction('game-icons', 100, 'refresh', {}, 'Quickscan', () => {
    if (gameModeManager !== undefined) {
      gameModeManager.startQuickDiscovery()
      .then((gameNames: string[]) => {
        const message = gameNames.length === 0
          ? 'No new games found'
          : gameNames.map(name => '- ' + name).join('\n');
        context.api.sendNotification({
          type: 'success',
          message: 'Discovery completed\n' + message,
        });
      });
    }
  });

  context.registerAction('game-managed-buttons', 100, HideGameIcon, {});
  context.registerAction('game-discovered-buttons', 100, HideGameIcon, {});
  context.registerAction('game-undiscovered-buttons', 100, HideGameIcon, {});

  const openGameFolder = (instanceIds: string[]) => {
    const discoveredGames = context.api.store.getState().settings.gameMode.discovered;
    const gamePath = getSafe(discoveredGames, [instanceIds[0], 'path'], undefined);
    if (gamePath !== undefined) {
      shell.openItem(gamePath);
    }
  };

  const openModFolder = (instanceIds: string[]) => {
    const discoveredGames = context.api.store.getState().settings.gameMode.discovered;
    const modPath = getSafe(discoveredGames, [instanceIds[0], 'modPath'], undefined);
    if (modPath !== undefined) {
      shell.openItem(modPath);
    }
  };

  context.registerAction('game-managed-buttons', 105, 'folder', {},
                         context.api.translate('Open Game Folder'),
                         openGameFolder);

  context.registerAction('game-discovered-buttons', 105, 'folder', {},
                         context.api.translate('Open Game Folder'),
                         openGameFolder);

  context.registerAction('game-managed-buttons', 110, 'folder-gallery', {},
                         context.api.translate('Open Mod Folder'),
                         openModFolder);

  context.registerAction('game-discovered-buttons', 110, 'folder-gallery', {},
                         context.api.translate('Open Mod Folder'),
                         openModFolder);

  context.registerDialog('add-game', AddGameDialog);

  context.once(() => {
    const store: Redux.Store<IState> = context.api.store;
    const events = context.api.events;

    const GameModeManagerImpl: typeof GameModeManager = require('./GameModeManager').default;
    gameModeManager = new GameModeManagerImpl(
      context.api.getPath('userData'),
      extensionGames,
      (gameMode: string) => {
        events.emit('gamemode-activated', gameMode);
      });
    gameModeManager.attachToStore(store);
    gameModeManager.startQuickDiscovery();

    events.on('start-discovery', () => gameModeManager.startSearchDiscovery());
    events.on('cancel-discovery', () => {
      log('info', 'received cancel discovery');
      gameModeManager.stopSearchDiscovery();
    });

    if (store.getState().settings.gameMode.searchPaths === undefined) {
      const {list} = require('drivelist');
      list((error, disks) => {
        if (error) {
          throw error;
        }
        for (const disk of disks.sort()) {
          // 'system' drives are the non-removable ones
          if (disk.system) {
            if (disk.mountpoints) {
              store.dispatch(addSearchPath(disk.mountpoints[0].path));
            } else {
              store.dispatch(addSearchPath(disk.mountpoint));
            }
          }
        }
      });
    }

    const changeGameMode = (oldGameId: string, newGameId: string, oldProfileId: string) => {
      if (newGameId === undefined) {
        return;
      }

      return gameModeManager.setupGameMode(newGameId)
        .then(() => {
          gameModeManager.setGameMode(oldGameId, newGameId);
        }).catch((err) => {
          showError(store.dispatch, 'Failed to set game mode', err);
          // unset profile
          store.dispatch(setNextProfile(undefined));
        });
    };

    context.api.onStateChange(['settings', 'profiles', 'activeProfileId'],
      (prev: string, current: string) => {
        const state = store.getState();
        const oldGameId = getSafe(state, ['persistent', 'profiles', prev, 'gameId'], undefined);
        const newGameId = getSafe(state, ['persistent', 'profiles', current, 'gameId'], undefined);
        log('debug', 'active profile id changed', { prev, current, oldGameId, newGameId });
        if (oldGameId !== newGameId) {
          changeGameMode(oldGameId, newGameId, prev);
        }
      });

    changeGameMode(undefined, activeGameId(store.getState()), undefined);
  });

  return true;
}

export default init;
