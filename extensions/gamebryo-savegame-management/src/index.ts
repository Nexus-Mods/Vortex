import { clearSavegames, setSavegamePath,
   setSavegames, showTransferDialog } from './actions/session';
import { sessionReducer } from './reducers/session';
import { ISavegame } from './types/ISavegame';
import {gameSupported, iniPath, mygamesPath} from './util/gameSupport';
import refreshSavegames from './util/refreshSavegames';
import SavegameList from './views/SavegameList';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import IniParser, {IniFile, WinapiFormat} from 'parse-ini';
import * as path from 'path';
import { selectors, types, util } from 'vortex-api';

const parser = new IniParser(new WinapiFormat());
let fsWatcher: fs.FSWatcher;

function updateSaveSettings(store: Redux.Store<any>,
                            profileId: string): Promise<string> {
  const currentProfile = selectors.activeProfile(store.getState());
  if (currentProfile === undefined) {
    // how did we get here then???
    return Promise.reject(new util.ProcessCanceled('no current profile'));
  }

  return parser.read(iniPath(currentProfile.gameId))
    .then((iniFile: IniFile<any>) => {
      const localPath = path.join('Saves', profileId);
      if (iniFile.data.General === undefined) {
        iniFile.data.General = {};
      }
      // TODO: we should provide a way for the user to set his own
      //   save path without overwriting it
      iniFile.data.General.SLocalSavePath =
          util.getSafe(currentProfile, ['features', 'local_saves'], false)
            ? localPath + path.sep
            : iniFile.data.General.SLocalSavePath = 'Saves' + path.sep;

      parser.write(iniPath(currentProfile.gameId), iniFile);

      store.dispatch(setSavegamePath(iniFile.data.General.SLocalSavePath));
      store.dispatch(clearSavegames());

      if (!gameSupported(currentProfile.gameId)) {
        return;
      }

      const readPath = mygamesPath(currentProfile.gameId) + path.sep +
        iniFile.data.General.SLocalSavePath;

      return fs.ensureDirAsync(readPath)
        .then(() => Promise.resolve(readPath));
    });
}

function updateSaves(store: Redux.Store<any>,
                     profileId: string,
                     savesPath: string): Promise<string[]> {
  const newSavegames: ISavegame[] = [];

  return refreshSavegames(savesPath, (save: ISavegame): void => {
    if (store.getState().session.saves[save.id] === undefined) {
      newSavegames.push(save);
    }
  })
  .then((failedReads: string[]) => Promise.resolve({ newSavegames, failedReads }))
  .then((result: { newSavegames: ISavegame[], failedReads: string[] }) => {
    const savesDict: { [id: string]: ISavegame } = {};
    result.newSavegames.forEach(
      (save: ISavegame) => { savesDict[save.id] = save; });

    store.dispatch(setSavegames(savesDict));
    return Promise.resolve(result.failedReads);
  });
}

function init(context): boolean {
  context.registerAction('savegames-icons', 200, 'cog', {}, 'Transfer Savegames', () => {
    context.api.store.dispatch(showTransferDialog(true));
  });

  context.registerMainPage('save', 'Save Games', SavegameList, {
    hotkey: 'A',
    group: 'per-game',
    visible: () => gameSupported(selectors.activeGameId(context.api.store.getState())),
  });

  context.registerReducer(['session', 'saves'], sessionReducer);
  context.registerProfileFeature(
      'local_saves', 'boolean', 'save', 'This profile has its own save games',
      () => gameSupported(selectors.activeGameId(context.api.store.getState())));

  context.once(() => {
    const store: Redux.Store<any> = context.api.store;

    context.api.events.on('profile-did-change', (profileId: string) => {
      const profile: types.IProfile =
          util.getSafe(store.getState(),
                       ['persistent', 'profiles', profileId], undefined);
      if ((profile === undefined) || !gameSupported(profile.gameId)) {
        return;
      }
      let savesPath: string;
      updateSaveSettings(store, profileId)
        .then(savesPathIn => {
          savesPath = savesPathIn;
          return updateSaves(store, profileId, savesPath);
        })
        .then((failedReads: string[]) => {
          if (failedReads.length > 0) {
            context.api.showErrorNotification('Some saves couldn\'t be read',
              failedReads.join('\n'));
          }

          if (fsWatcher !== undefined) {
            fsWatcher.close();
          }
          const update = new util.Debouncer(() => {
            return updateSaves(store, profileId, savesPath)
              .then((failedReadsInner: string[]) => {
                if (failedReadsInner.length > 0) {
                  context.api.showErrorNotification('Some saves couldn\'t be read',
                    failedReadsInner.join('\n'));
                }
            });
          }, 1000);
          fsWatcher = fs.watch(savesPath, {}, (evt: string, filename: string) => {
            update.schedule(undefined);
          });
        });
    });
  });

  return true;
}

export default init;
