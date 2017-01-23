import { clearSavegames, setSavegames } from './actions/session';
import { sessionReducer } from './reducers/session';
import { ISavegame } from './types/ISavegame';
import {gameSupported, savesPath} from './util/gameSupport';
import refreshSavegames from './util/refreshSavegames';
import SavegameList from './views/SavegameList';

function init(context): boolean {
  context.registerMainPage('hdd-o', 'Save Games', SavegameList, {
    hotkey: 'S',
    visible: () => gameSupported(context.api.store.getState().settings.gameMode.current),
  });

  context.registerReducer(['session', 'saves'], sessionReducer);

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;

    context.api.events.on('gamemode-activated', (gameMode: string) => {
      store.dispatch(clearSavegames());

      if (!gameSupported(gameMode)) {
        return;
      }

      let readPath = savesPath(gameMode);

      let newSavegames: ISavegame[] = [];
      refreshSavegames(readPath, (save: ISavegame): void => {
        if (store.getState().session.saves[save.id] === undefined) {
          newSavegames.push(save);
        }
      })
        .then((failedReads: string[]) => {
          let savesDict: { [id: string]: ISavegame } = {};
          newSavegames.forEach((save: ISavegame) => {
            savesDict[save.id] = save;
          });

          store.dispatch(setSavegames(savesDict));
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
