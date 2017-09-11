import { IModEntry } from '../types/moEntries';
import { transferArchive, transferUnpackedMod } from '../util/modFileMigration';

import { IMOConfig } from './parseMOIni';
import toVortexMod from './toVortexMod';
import TraceImport from './TraceImport';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as I18next from 'i18next';
import { genHash } from 'modmeta-db';
import * as path from 'path';
import { generate as shortid } from 'shortid';
import { actions, selectors, types } from 'vortex-api';

function getInner(ele: Element): string {
  if ((ele !== undefined) && (ele !== null)) {
    const node = ele.childNodes[0];
    if (node !== undefined) {
      return node.nodeValue;
    }
  }
  return undefined;
}

function importMods(t: I18next.TranslationFunction,
                    store: Redux.Store<types.IState>,
                    trace: TraceImport,
                    moConfig: IMOConfig,
                    mods: IModEntry[],
                    importArchives: boolean,
                    progress: (mod: string, idx: number) => void): Promise<string[]> {
  const gameId = selectors.activeGameId(store.getState());

  const errors: string[] = [];

  return trace.writeFile('parsedMods.json', JSON.stringify(mods))
    .then(() => {
      trace.log('info', 'transfer unpacked mods files');
      const installPath = selectors.installPath(store.getState());
      const downloadPath = selectors.downloadPath(store.getState());
      return Promise.mapSeries(mods, (mod, idx, len) => {
        trace.log('info', 'transferring', mod);
        progress(mod.modName, idx / len);
        const archivePath = path.isAbsolute(mod.archiveName)
          ? mod.archiveName
          : path.join(moConfig.downloadPath, mod.archiveName);
        return transferUnpackedMod(mod, path.join(moConfig.modPath, mod.modName), installPath, true)
          .then(() => ((mod.archiveName === undefined) || (mod.archiveName === ''))
            ? Promise.resolve('')
            : genHash(archivePath)
              .then(hash => hash.md5sum)
              .catch(err => ''))
          .then(md5Hash => {
            store.dispatch(actions.addMod(gameId, toVortexMod(mod, md5Hash)));

            if (importArchives && !!mod.archiveName) {
              trace.log('info', 'transferring archive', archivePath);
              progress(mod.modName + ' (' + t('Archive') + ')', idx / len);
              return transferArchive(archivePath, downloadPath, true);
            } else {
              return Promise.resolve();
            }
          })
          .catch(err => {
            trace.log('error', 'Failed to import', err);
            errors.push(mod.modName);
          });
      })
        .then(() => {
          trace.log('info', 'Finished transferring unpacked mod files');
        });
    })
    .then(() => {
      trace.finish();
      return errors;
    });
}

export default importMods;
