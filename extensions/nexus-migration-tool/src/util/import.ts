import { transferArchives, transferUnpackedMod} from '../util/modFileMigration';

import {IModEntry} from '../types/nmmEntries';
import TraceImport from './TraceImport';
import { addMods, createProfile } from './vortexImports';

import * as Promise from 'bluebird';
import { generate as shortid } from 'shortid';
import { actions, selectors, types } from 'vortex-api';

function importMods(api: types.IExtensionApi,
                    trace: TraceImport,
                    sourcePath: string,
                    mods: IModEntry[],
                    progress: (mod: string, idx: number) => void): Promise<string[]> {
  const state = api.store.getState();

  const errors: string[] = [];

  return trace.writeFile('parsedMods.json', JSON.stringify(mods))
    .then(() => {
      trace.log('info', 'transfer unpacked mods files');
      const installPath = selectors.installPath(state);
      return Promise.mapSeries(mods, (mod, idx) => {
        trace.log('info', 'transfering', mod.modName);
        progress(mod.modName, idx);
        return transferUnpackedMod(mod, sourcePath, installPath, true)
          .then(failed => {
            if (failed.length > 0) {
              trace.log('error', 'Failed to import', failed);
              errors.push(mod.modName);
            }
          });
      })
        .then(() => {
          trace.log('info', 'Finished transfering unpacked mod files');
          const gameId = selectors.activeGameId(state);
          const profileId = shortid();
          createProfile(gameId, profileId, 'Imported NMM Profile', api.store.dispatch);
          addMods(gameId, profileId, mods, api.store.dispatch);
        });
    })
    .then(() => {
      trace.finish();
      return errors;
    });
}

export default importMods;
