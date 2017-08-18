import { transferArchives, transferUnpackedMod} from '../util/modFileMigration';

import {IModEntry} from '../types/nmmEntries';
import TraceImport from './TraceImport';
import { addMods, createProfile } from './vortexImports';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { generate as shortid } from 'shortid';
import { actions, selectors, types } from 'vortex-api';

function enhance(sourcePath: string, input: IModEntry): Promise<IModEntry> {
  // this id is currently identically to what we store as the vortexId but I don't want
  // to rely on that always being the case
  const id = path.basename(input.modFilename, path.extname(input.modFilename));
  const cacheBasePath = path.resolve(sourcePath, '..', 'cache', id);
  return fs.readFileAsync(path.join(cacheBasePath, 'cacheInfo.txt'))
    .then(data => {
      const fields = data.toString().split('@@');
      return fs.readFileAsync(path.join(cacheBasePath, fields[1], 'fomod', 'info.xml'));
    })
    .then(infoXmlData => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(infoXmlData.toString(), 'text/xml');
      const origCategory = xmlDoc.querySelector('fomod CategoryId');
      const customCategory = xmlDoc.querySelector('fomod CustomCategoryId');

      return {
        ...input,
        categoryId: parseInt((customCategory || origCategory).childNodes[0].nodeValue, 10),
      };
    });
}

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
      return Promise.map(mods, mod => enhance(sourcePath, mod))
      .then(modsEx => Promise.mapSeries(modsEx, (mod, idx) => {
        trace.log('info', 'transferring', mod);
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
          trace.log('info', 'Finished transferring unpacked mod files');
          const gameId = selectors.activeGameId(state);
          const profileId = shortid();
          createProfile(gameId, profileId, 'Imported NMM Profile', api.store.dispatch);
          addMods(gameId, profileId, modsEx, api.store.dispatch);
        }));
    })
    .then(() => {
      trace.finish();
      return errors;
    });
}

export default importMods;
