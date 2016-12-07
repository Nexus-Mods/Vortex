import { IExtensionContext } from '../../types/IExtensionContext';

import { addSavegame, clearSavegames, setSavegamelistAttributeVisible } from './actions/session';
import { sessionReducer } from './reducers/session';
import { ISavegame } from './types/ISavegame';
import { ISavegameAttribute } from './types/ISavegameAttribute';
import {gameSupported, savesPath} from './util/gameSupport';
import refreshSavegames from './util/refreshSavegames';
import SavegameList from './views/SavegameList';

import {
  CREATION_TIME, FILENAME, LEVEL, LOCATION, PLUGINS, SAVEGAME_ID,
  SAVEGAME_NAME, SCREENSHOT,
} from './savegameAttributes';

export interface IExtensionContextExt extends IExtensionContext {
  registerSavegameAttribute: (attribute: ISavegameAttribute) => void;
}

function init(context: IExtensionContextExt): boolean {
  context.registerMainPage('hdd-o', 'Save Games', SavegameList, {
    hotkey: 'S',
    visible: () => gameSupported(context.api.store.getState().settings.gameMode.current),
  });

  context.registerReducer(['session', 'saves'], sessionReducer);
  context.registerReducer(['session', 'savegamelistState'], sessionReducer);

  if (context.registerSavegameAttribute !== undefined) {
    [SAVEGAME_ID, SAVEGAME_NAME, LEVEL, LOCATION, FILENAME, CREATION_TIME, SCREENSHOT, PLUGINS]
      .forEach(context.registerSavegameAttribute);
  }

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;

    {
      const readPath: string = savesPath(store.getState().settings.gameMode.current);

      refreshSavegames(readPath, (save: ISavegame): void => {
        store.dispatch(addSavegame(save));
      })
        .then((failedReads: string[]) => {
          if (failedReads.length > 0) {
            context.api.showErrorNotification('Some saves couldn\'t be read',
                                              failedReads.join('\n'));
          }
        })
        ;
    }

    store.dispatch(setSavegamelistAttributeVisible('id', false));
    store.dispatch(setSavegamelistAttributeVisible('filename', false));

    context.api.events.on('gamemode-activated', (gameMode: string) => {
      store.dispatch(clearSavegames());
      let readPath = savesPath(store.getState().settings.gameMode.current);

      refreshSavegames(readPath, (save: ISavegame): void => {
        if (store.getState().session.saves[save.id] === undefined) {
          store.dispatch(addSavegame(save));
        }
      })
        .then((failedReads: string[]) => {
          if (failedReads.length > 0) {
            context.api.showErrorNotification(
              'Some saves couldn\'t be read',
              failedReads.join('\n'));
          }
        });
    });
  });

  return true;
}

export default init;
