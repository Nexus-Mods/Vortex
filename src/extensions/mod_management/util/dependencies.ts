import {IExtensionApi} from '../../../types/IExtensionContext';
import { IDownload, IState } from '../../../types/IState';
import {log} from '../../../util/log';
import {activeGameId} from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

import { DownloadIsHTML } from '../../download_management/DownloadManager';

import {Dependency} from '../types/IDependency';
import { IMod, IModRule } from '../types/IMod';

import testModReference, { IModLookupInfo } from './testModReference';

import * as Promise from 'bluebird';
import {ILookupResult, IReference, IRule} from 'modmeta-db';

function findModByRef(reference: IReference, state: IState): IMod {
  const gameMode = activeGameId(state);
  const mods = state.persistent.mods[gameMode];

  return Object.values(mods).find((mod: IMod): boolean =>
    testModReference(mod, reference));
}

function findDownloadByRef(reference: IReference, state: IState): string {
  const downloads = state.persistent.downloads.files;
  const existing: string = Object.keys(downloads).find((dlId: string): boolean => {
    const download: IDownload = downloads[dlId];
    const lookup: IModLookupInfo = {
      fileMD5: download.fileMD5,
      fileName: download.localPath,
      fileSizeBytes: download.size,
      version: getSafe(download, ['modInfo', 'version'], undefined),
      logicalFileName: getSafe(download, ['modInfo', 'name'], undefined),
    };

    return testModReference(lookup, reference);
  });
  return existing;
}

function browseForDownload(api: IExtensionApi, url: string, instruction: string): Promise<string> {
  return api.emitAndAwait('browse-for-download', url, instruction);
}

function gatherDependencies(rules: IModRule[],
                            api: IExtensionApi,
                            recommendations: boolean)
                            : Promise<Dependency[]> {
  const state = api.store.getState();
  const requirements: IModRule[] =
      rules === undefined ?
          [] :
          rules.filter((rule: IRule) =>
            rule.type === (recommendations ? 'recommends' : 'requires'));

  // for each requirement, look up the reference and recursively their dependencies
  return Promise.reduce(requirements, (total: Dependency[], rule: IModRule) => {
    if (findModByRef(rule.reference, state)) {
      return total;
    }

    // if the rule specifies how to download the file, follow those instructions
    if (rule.downloadHint !== undefined) {
      const download = findDownloadByRef(rule.reference, state);
      if (rule.downloadHint.mode === 'direct') {
        total.push({
          download,
          reference: rule.reference,
          fileList: rule.fileList,
          lookupResults: [
            {
              key: 'from-download-hint', value: {
                fileName: rule.reference.logicalFileName,
                fileSizeBytes: rule.reference.fileSize,
                gameId: rule.reference.gameId,
                fileVersion: undefined,
                fileMD5: rule.reference.fileMD5,
                sourceURI: rule.downloadHint.url,
              },
            },
          ],
        });
        return total;
      } else if (rule.downloadHint.mode === 'browse') {
        return browseForDownload(api, rule.downloadHint.url, rule.downloadHint.instructions)
          .then(downloadUrl => {
            total.push({
              download,
              reference: rule.reference,
              fileList: rule.fileList,
              lookupResults: [
                {
                  key: 'from-download-hint', value: {
                    fileName: rule.reference.logicalFileName,
                    fileSizeBytes: rule.reference.fileSize,
                    gameId: rule.reference.gameId,
                    fileVersion: undefined,
                    fileMD5: rule.reference.fileMD5,
                    sourceURI: downloadUrl,
                  },
                },
              ],
            });
            return total;
          })
          .catch(DownloadIsHTML, err => {
            api.showErrorNotification('Invalid download selected', err, { allowReport: false });
            return total;
          });
      } else {
        total.push({ error: rule.downloadHint.instructions });
        return total;
      }
    }

    let lookupDetails: ILookupResult[];

    // otherwise consult the meta database
    return api.lookupModReference(rule.reference)
        .then((details: ILookupResult[]) => {
          lookupDetails = details;

          if ((details.length === 0) || (details[0].value === undefined)) {
            throw new Error('reference not found: ' + JSON.stringify(rule.reference));
          }

          return gatherDependencies(details[0].value.rules, api, recommendations);
        })
        .then((dependencies: Dependency[]) => {
          return [].concat(total, dependencies, [{
            download: findDownloadByRef(rule.reference, state),
            reference: rule.reference,
            lookupResults: lookupDetails,
            fileList: rule.fileList,
          }]);
        })
        .catch((err: Error) => {
          log('warn', 'failed to look up', err.message);
          return [].concat(total, { error: err.message });
        });
  }, []);
}

export default gatherDependencies;
