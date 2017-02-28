import { IExtensionContext } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import { ITestResult } from '../../types/ITestResult';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { activeGameId } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';

import { setNextProfile } from '../profile_management/actions/settings';

import { addSearchPath } from './actions/settings';
import { discoveryReducer } from './reducers/discovery';
import { sessionReducer } from './reducers/session';
import { settingsReducer } from './reducers/settings';

import GameModeManager from './GameModeManager';
import GamePicker from './views/GamePicker';
import HideGameIcon from './views/HideGameIcon';
import ProgressFooter from './views/ProgressFooter';
import Settings from './views/Settings';

import * as Promise from 'bluebird';

function init(context: IExtensionContext): boolean {
  context.registerMainPage('gamepad', 'Games', GamePicker, {
    hotkey: 'G',
  });
  context.registerSettings('Games', Settings);
  context.registerReducer(['session', 'discovery'], discoveryReducer);
  context.registerReducer(['session', 'gameMode'], sessionReducer);
  context.registerReducer(['settings', 'gameMode'], settingsReducer);
  context.registerFooter('discovery-progress', ProgressFooter);

  context.registerIcon('game-discovered-buttons', HideGameIcon);
  context.registerIcon('game-undiscovered-buttons', HideGameIcon);

  const testOblivionFonts = () => new Promise<ITestResult>((resolve, reject) => {

    // TODO LUCO Missing something here

    const messages = 'List of missing fonts: ';

    return resolve({
      description: {
        short: 'Oblivion ini font not installed.',
        long: messages,
      },
      severity: 'error',
      automaticFix: () => new Promise<void>((fixResolve, fixReject) => {
        context.api.events.emit('show-modal', 'settings');
        context.api.events.on('hide-modal', (modal) => {
          if (modal === 'settings') {
            fixResolve();
          }
        });
      }),
    });
  });

  // LUCO TODO disabled
  // context.registerTest('oblivion-fonts', 'gamemode-activated', testOblivionFonts);

  context.once(() => {
    let store: Redux.Store<IState> = context.api.store;
    let events = context.api.events;

    const GameModeManagerImpl: typeof GameModeManager = require('./GameModeManager').default;
    let gameModeManager = new GameModeManagerImpl(
      context.api.getPath('userData'), (gameMode: string) => {
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
        for (let disk of disks.sort()) {
          // 'system' drives are the non-removable ones
          if (disk.system) {
            store.dispatch(addSearchPath(disk.mountpoint));
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

          if (newGameId === 'oblivion') { // TODO LUCO waiting Oblivion implementation
          let oblivionIni = getSafe(store.getState(),
            ['settings', 'gameMode', 'discovered', newGameId, 'path'],
            null).concat('\Oblivion_default.ini');

          events.emit('oblivion-check-fonts', oblivionIni, newGameId, store);
          }

        }).catch((err) => {
          showError(store.dispatch, 'Failed to set game mode', err);
          // try to revert
          store.dispatch(setNextProfile(oldProfileId));
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
