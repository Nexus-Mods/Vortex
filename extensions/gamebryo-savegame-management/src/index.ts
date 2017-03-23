import { clearSavegames, setSavegamePath, setSavegames } from './actions/session';
import { sessionReducer } from './reducers/session';
import { ISavegame } from './types/ISavegame';
import {gameSupported, iniPath, mygamesPath} from './util/gameSupport';
import refreshSavegames from './util/refreshSavegames';
import SavegameList from './views/SavegameList';

import * as fs from 'fs-extra-promise';
import { selectors, util } from 'nmm-api';
import IniParser, {IniFile, WinapiFormat} from 'parse-ini';

let parser = new IniParser(new WinapiFormat());

function updateSaves(store: Redux.Store<any>,
                     profileId: string): Promise<string[]> {
  let currentProfile = selectors.activeProfile(store.getState());
  return parser.read(iniPath(currentProfile.gameId))
      .then((iniFile: IniFile<any>) => {
        let localPath = `Saves/${profileId}`;
        // TODO we should provide a way for the user to set his own
        //   save path without overwriting it
        if (util.getSafe(currentProfile, ['features', 'local_saves'], false)) {
          iniFile.data.General.SLocalSavePath = localPath;
        } else {
          iniFile.data.General.SLocalSavePath = 'Saves\\';
        }
        parser.write(iniPath(currentProfile.gameId), iniFile);

        store.dispatch(setSavegamePath(iniFile.data.General.SLocalSavePath));
        store.dispatch(clearSavegames());

        if (!gameSupported(currentProfile.gameId)) {
          return;
        }

        let readPath = mygamesPath(currentProfile.gameId) + '\\' +
                       iniFile.data.General.SLocalSavePath;

        return fs.ensureDirAsync(readPath)
            .then(() => Promise.resolve(readPath));
      })
      .then((readPath: string) => {
        let newSavegames: ISavegame[] = [];
        return refreshSavegames(readPath, (save: ISavegame): void => {
                 if (store.getState().session.saves[save.id] === undefined) {
                   newSavegames.push(save);
                 }
               }).then((failedReads: string[]) => Promise.resolve({ newSavegames, failedReads }));
      })
      .then((result: { newSavegames: ISavegame[], failedReads: string[] }) => {
        let savesDict: {[id: string]: ISavegame} = {};
        result.newSavegames.forEach(
            (save: ISavegame) => { savesDict[save.id] = save; });

        store.dispatch(setSavegames(savesDict));
        return Promise.resolve(result.failedReads);
      });
}

function init(context): boolean {
  context.registerMainPage('hdd-o', 'Save Games', SavegameList, {
    hotkey: 'S',
    group: 'per-game',
    visible: () => gameSupported(selectors.activeGameId(context.api.store.getState())),
  });

  context.registerReducer(['session', 'saves'], sessionReducer);
  context.registerProfileFeature(
      'local_saves', 'boolean', 'save', 'This profile has its own save games',
      () => gameSupported(selectors.activeGameId(context.api.store.getState())));

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;

    context.api.events.on('profile-activated', (profileId: string) => {
      updateSaves(store, profileId)
          .then((failedReads: string[]) => {
            if (failedReads.length > 0) {
              context.api.showErrorNotification('Some saves couldn\'t be read',
                                                failedReads.join('\n'));
            }
          });
    });
  });

  return true;
}

export default init;
