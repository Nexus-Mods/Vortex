import {IExtensionApi} from '../../../types/IExtensionContext';
import { IDownload, IState } from '../../../types/IState';
import { ProcessCanceled } from '../../../util/CustomErrors';
import {log} from '../../../util/log';
import {activeGameId} from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

import { IBrowserResult } from '../../browser/types';

import {Dependency, IDependency, ILookupResultEx} from '../types/IDependency';
import { IDownloadHint, IMod, IModRule } from '../types/IMod';

import testModReference, { IModLookupInfo } from './testModReference';

import * as Promise from 'bluebird';
import * as _ from 'lodash';
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

function browseForDownload(api: IExtensionApi,
                           url: string,
                           instruction: string)
                           : Promise<IBrowserResult> {
  return api.emitAndAwait('browse-for-download', url, instruction);
}

function lookupDownloadHint(api: IExtensionApi,
                            input: IDownloadHint)
                            : Promise<IBrowserResult> {
  if (input === undefined) {
    return Promise.resolve(undefined);
  }

  if (input.mode === 'direct') {
    return Promise.resolve({ url: input.url });
  } else if (input.mode === 'browse') {
    return browseForDownload(api, input.url, input.instructions);
  } else {
    throw Promise.reject(new ProcessCanceled(input.instructions));
  }
}

function makeLookupResult(lookup: ILookupResult, fromHint: IBrowserResult): ILookupResultEx {
  if (fromHint === undefined) {
    return lookup;
  }

  return _.merge(lookup, {
    value: {
      sourceURI: fromHint.url,
      referer: fromHint.referer,
    },
  });
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
    const mod: IMod = findModByRef(rule.reference, state);
    const download = findDownloadByRef(rule.reference, state);

    let urlFromHint: IBrowserResult;

    // if the rule specifies how to download the file, follow those instructions

    let lookupDetails: ILookupResult[];

    // otherwise consult the meta database
    return ((download !== undefined)
              ? Promise.resolve(undefined)
              : lookupDownloadHint(api, rule.downloadHint))
        .then(res => {
          urlFromHint = res;
          return api.lookupModReference(rule.reference);
        })
        .then((details: ILookupResult[]) => {
          lookupDetails = details;

          return ((details.length === 0) || (details[0].value === undefined))
            ? Promise.resolve([])
            : gatherDependencies(details[0].value.rules, api, recommendations);
        })
        .then((dependencies: Dependency[]) => {
          const res: IDependency = {
            download,
            reference: rule.reference,
            lookupResults: (lookupDetails.length > 0)
              ? lookupDetails.map(iter => makeLookupResult(iter, urlFromHint))
              : (urlFromHint !== undefined)
              ? [{
                key: 'from-download-hint', value: {
                  fileName: rule.reference.logicalFileName,
                  fileSizeBytes: rule.reference.fileSize,
                  gameId: rule.reference.gameId,
                  fileVersion: undefined,
                  fileMD5: rule.reference.fileMD5,
                  sourceURI: urlFromHint.url,
                  referer: urlFromHint.referer,
                },
              }]
              : [],
            fileList: rule.fileList,
            installerChoices: rule.installerChoices,
            mod,
          };
          return [].concat(total, dependencies, [res]);
        })
        .catch((err: Error) => {
          if (!(err instanceof ProcessCanceled)) {
            log('warn', 'failed to look up', err.message);
          }
          return [].concat(total, { error: err.message });
        });
  }, []);
}

export default gatherDependencies;
