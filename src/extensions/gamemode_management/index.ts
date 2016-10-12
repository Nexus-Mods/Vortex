import { IExtensionContext } from '../../types/IExtensionContext';

import { addSearchPath } from './actions/settings';
import GameModeManager from './GameModeManager';
import { discoveryReducer } from './reducers/discovery';
import { sessionReducer } from './reducers/session';
import { settingsReducer } from './reducers/settings';
import GamePicker from './views/GamePicker';
import Settings from './views/Settings';

import { log } from '../../util/log';

import { list } from 'drivelist';

let gameModeManager: GameModeManager;

function init(context: IExtensionContext): boolean {
  context.registerMainPage('gamepad', 'Games', GamePicker);
  context.registerSettings('Games', Settings);
  context.registerReducer(['session', 'discovery'], discoveryReducer);
  context.registerReducer(['session', 'gameMode'], sessionReducer);
  context.registerReducer(['settings', 'gameMode'], settingsReducer);

  context.once(() => {
    gameModeManager = new GameModeManager(context.api.getPath('userData'));
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
      log('info', 'no search paths configured');
      list((error, disks) => {
        if (error) {
          throw error;
        }
        for (let disk of disks) {
          // 'system' drives are the non-removable ones
          if (disk.system) {
            context.api.store.dispatch(addSearchPath(disk.mountpoint));
          }
        }
      });
    }

    context.api.onStateChange(['settings', 'gameMode', 'current'],
      (prev: string, current: string) => {
        gameModeManager.setGameMode(prev, current);
    });
    gameModeManager.setGameMode(undefined, context.api.store.getState().settings.gameMode.current);
  });

  return true;
}

export default init;
