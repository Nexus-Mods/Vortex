import SavegameList from './views/SavegameList';

import { addSavegame, clearSavegames } from './actions/session';

import { IExtensionContext } from '../../types/IExtensionContext';

import { ISavegame } from './types/ISavegame';

import { remote } from 'electron';

import * as path from 'path';

import {CREATION_TIME, LEVEL, LOCATION, PLUGINS, SAVEGAME_ID,
   SAVEGAME_NAME, SCREENSHOT} from './savegameAttributes';

import { ISavegameAttribute } from './types/ISavegameAttribute';

import refreshSavegames from './util/refreshSavegames';

import { sessionReducer } from './reducers/session';

export interface IExtensionContextExt extends IExtensionContext {
  registerSavegameAttribute: (attribute: ISavegameAttribute) => void;
}

function init(context: IExtensionContextExt): boolean {

  context.registerMainPage('clone', 'Save Games', SavegameList, {
    hotkey: 'S',
  });

  context.registerReducer(['session', 'saves'], sessionReducer);
  context.registerReducer(['session', 'savegamelistState'], sessionReducer);

  if (context.registerSavegameAttribute !== undefined) {
    context.registerSavegameAttribute(SAVEGAME_ID);
    context.registerSavegameAttribute(SAVEGAME_NAME);
    context.registerSavegameAttribute(LOCATION);
    context.registerSavegameAttribute(LEVEL);
    context.registerSavegameAttribute(CREATION_TIME);
    context.registerSavegameAttribute(SCREENSHOT);
    context.registerSavegameAttribute(PLUGINS);
  }

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;

    let installPath = path.join(remote.app.getPath('documents'),
      'my games', store.getState().settings.gameMode.current, 'saves');

    refreshSavegames(installPath, (save: ISavegame): void => {
        context.api.store.dispatch(addSavegame(save));
    });

    context.api.onStateChange(
      ['settings', 'gameMode', 'current'],
      (previous: string, current: string) => {
        // TODO after changing the game mode it may take a moment for the
        //   system to read game-specific settings. This delay is not a proper
        //   solution
        setTimeout(() => {
          context.api.store.dispatch(clearSavegames());
          refreshSavegames(installPath, (save: ISavegame) => {
            if (store.getState().saves[save.id] === undefined) {
              context.api.store.dispatch(addSavegame(save));
            }
          });
        }, 200);
      });
  });

  return true;
}

export default init;
