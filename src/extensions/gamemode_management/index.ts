import { IExtensionContext, PersistingType } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import { showError } from '../../util/message';

import { addSearchPath, setCurrentGameMode } from './actions/settings';
import { discoveryReducer } from './reducers/discovery';
import { sessionReducer } from './reducers/session';
import { settingsReducer } from './reducers/settings';

import GamePicker from './views/GamePicker';
import ProgressFooter from './views/ProgressFooter';
import Settings from './views/Settings';

import GameModeManager from './GameModeManager';

let stateWhitelist = ['gameSettings'];

function init(context: IExtensionContext): boolean {
  context.registerMainPage('gamepad', 'Games', GamePicker, {
    hotkey: 'G',
  });
  context.registerSettings('Games', Settings);
  context.registerReducer(['session', 'discovery'], discoveryReducer);
  context.registerReducer(['session', 'gameMode'], sessionReducer);
  context.registerReducer(['settings', 'gameMode'], settingsReducer);
  context.registerFooter('discovery-progress', ProgressFooter);

  context.registerSettingsHive = (type: PersistingType, hive: string) => {
    if (type === 'game') {
      stateWhitelist.push(hive);
    }
  };

  context.once(() => {
    const GameModeManagerImpl: typeof GameModeManager = require('./GameModeManager').default;
    let gameModeManager = new GameModeManagerImpl(
        context.api.getPath('userData'), (gameMode: string) => {
          context.api.events.emit('gamemode-activated', gameMode);
        }, stateWhitelist);
    gameModeManager.attachToStore(context.api.store);
    gameModeManager.startQuickDiscovery();
    context.api.events.on('start-discovery',
      () => gameModeManager.startSearchDiscovery());

    context.api.events.on('cancel-discovery',
      () => {
        log('info', 'received cancel discovery');
        gameModeManager.stopSearchDiscovery();
      });

    if (context.api.store.getState().settings.gameMode.searchPaths === undefined) {
      const { list } = require('drivelist');
      list((error, disks) => {
        if (error) {
          throw error;
        }
        for (let disk of disks.sort()) {
          // 'system' drives are the non-removable ones
          if (disk.system) {
            context.api.store.dispatch(addSearchPath(disk.mountpoint));
          }
        }
      });
    }

    context.api.onStateChange(['settings', 'gameMode', 'next'],
      (prev: string, current: string) => {
        gameModeManager.setupGameMode(current)
        .then(() => {
          context.api.store.dispatch(setCurrentGameMode(current));
        })
        .catch((err) => {
          showError(context.api.store.dispatch, 'Failed to set game mode', err);
        })
        ;
      });

    context.api.onStateChange(['settings', 'gameMode', 'current'],
      (prev: string, current: string) => {
        gameModeManager.setGameMode(prev, current);
    });

    gameModeManager.setGameMode(undefined, context.api.store.getState().settings.gameMode.current);
  });

  return true;
}

export default init;
