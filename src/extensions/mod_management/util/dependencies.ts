import {IExtensionApi} from '../../../types/IExtensionContext';
import { IDownload, IState } from '../../../types/IState';
import { ProcessCanceled } from '../../../util/CustomErrors';
import {log} from '../../../util/log';
import {activeGameId} from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';

import { IBrowserResult } from '../../browser/types';

import { Dependency, IDependency, ILookupResultEx } from '../types/IDependency';
import { IDownloadHint, IMod, IModRule } from '../types/IMod';

import testModReference, { IModLookupInfo } from './testModReference';

import * as Promise from 'bluebird';
import * as _ from 'lodash';
import {ILookupResult, IReference, IRule} from 'modmeta-db';
import * as semver from 'semver';

export function isFuzzyVersion(versionMatch: string) {
  if (!truthy(versionMatch)) {
    return false;
  }

  return isNaN(parseInt(versionMatch[0], 16))
    || (semver.validRange(versionMatch)
      !== versionMatch);
}

function findModByRef(reference: IReference, state: IState): IMod {
  const gameMode = activeGameId(state);
  const mods = state.persistent.mods[gameMode];

  if ((reference.versionMatch !== undefined)
      && isFuzzyVersion(reference.versionMatch)
      && (reference.fileMD5 !== undefined)
      && ((reference.logicalFileName !== undefined)
          || (reference.fileExpression !== undefined))) {
    reference = _.omit(reference, ['fileMD5']);
  }

  return Object.values(mods).find((mod: IMod): boolean =>
    testModReference(mod, reference));
}

function newerSort(lhs: IDownload, rhs: IDownload): number {
  const lVersion = semver.coerce(getSafe(lhs, ['modInfo', 'version'], undefined));
  const rVersion = semver.coerce(getSafe(rhs, ['modInfo', 'version'], undefined));

  if ((lVersion !== null) && (rVersion !== null)) {
    return semver.compare(rVersion, lVersion);
  }

  return rhs.fileTime - lhs.fileTime;
}

function findDownloadByRef(reference: IReference, state: IState): string {
  const downloads = state.persistent.downloads.files;

  if (isFuzzyVersion(reference.versionMatch)
    && (reference.fileMD5 !== undefined)
    && ((reference.logicalFileName !== undefined)
      || (reference.fileExpression !== undefined))) {
    reference = _.omit(reference, ['fileMD5']);
  }

  const existing: string[] = Object.keys(downloads).filter((dlId: string): boolean => {
    const download: IDownload = downloads[dlId];
    const lookup: IModLookupInfo = {
      fileMD5: download.fileMD5,
      fileName: download.localPath,
      fileSizeBytes: download.size,
      version: getSafe(download, ['modInfo', 'version'], undefined),
      logicalFileName: getSafe(download, ['modInfo', 'name'], undefined),
      game: download.game,
    };

    return testModReference(lookup, reference);
  })
  .sort((lhs, rhs) => newerSort(downloads[lhs], downloads[rhs]));
  return existing[0];
}

function browseForDownload(api: IExtensionApi,
                           url: string,
                           instruction: string)
                           : Promise<IBrowserResult> {
  return new Promise((resolve, reject) => {
    let lookupResult: Promise<{ url: string, referer: string }>;

    const doLookup = () => {
      if (lookupResult === undefined) {
        lookupResult = api.emitAndAwait('browse-for-download', url, instruction)
          .then(resultList => resultList[0]);
      }
      return lookupResult;
    };

    return resolve({
      url: () => doLookup().then(out => out?.url),
      referer: () => doLookup().then(out => out?.referer),
    });
  });
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

/**
 * from a set of requires/recommends rules, deduce which of them need to be downloaded
 * and/or installed
 * @param rules
 * @param api
 * @param recommendations
 */
function gatherDependencies(rules: IModRule[],
                            api: IExtensionApi,
                            recommendations: boolean,
                            progressCB?: (percent: number) => void)
                            : Promise<Dependency[]> {
  const state = api.store.getState();
  const requirements: IModRule[] =
      rules === undefined ?
          [] :
          rules.filter((rule: IRule) =>
            rule.type === (recommendations ? 'recommends' : 'requires'));

  let numCompleted = 0;
  const onProgress = () => {
    ++numCompleted;
    if (progressCB !== undefined) {
      progressCB(numCompleted / requirements.length);
    }
  };

  return Promise.all(requirements.map((rule: IModRule): Promise<Dependency[][]> => {
    const mod: IMod = findModByRef(rule.reference, state);
    if (mod !== undefined) {
      return Promise.resolve([]);
    }

    const download = findDownloadByRef(rule.reference, state);

    let urlFromHint: IBrowserResult;

    // if the rule specifies how to download the file, follow those instructions

    let lookupDetails: ILookupResult[];

    // otherwise consult the meta database
    return ((download !== undefined)
              ? Promise.resolve(undefined)
              : lookupDownloadHint(api, rule.downloadHint))
        .then(res => {
          urlFromHint = truthy(res) ? res : undefined;
          // we may have all the information about the mod in rule.reference already but
          // for all we know the mod itself has further dependencies that need to be downloaded
          return api.lookupModReference(rule.reference, { requireURL: true });
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
            extra: rule.extra,
            mod,
          };
          return [].concat(dependencies, [res]);
        })
        .catch((err: Error) => {
          if (!(err instanceof ProcessCanceled)) {
            log('warn', 'failed to look up', err.message);
          }
          return [{ error: err.message }];
        })
        .finally(() => {
          onProgress();
        });
  }))
  .then(dependencyLists => [].concat(...dependencyLists));
}

export default gatherDependencies;
