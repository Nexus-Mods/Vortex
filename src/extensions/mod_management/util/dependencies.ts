import {IExtensionApi} from '../../../types/IExtensionContext';
import { IDownload, IState } from '../../../types/IState';
import {log} from '../../../util/log';
import {activeGameId} from '../../../util/selectors';
import {getSafe} from '../../../util/storeHelper';
import { truthy } from '../../../util/util';

import {IDependency} from '../types/IDependency';
import { IMod } from '../types/IMod';

import Promise from 'bluebird';
import * as _ from 'lodash';
import {ILookupResult, IReference, IRule} from 'modmeta-db';
import * as semver from 'semver';
import testModReference, { IModLookupInfo } from './testModReference';

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
      // game: download.game,
    };

    return testModReference(lookup, reference);
  })
  .sort((lhs, rhs) => newerSort(downloads[lhs], downloads[rhs]));
  return existing[0];
}

function gatherDependencies(
    rules: IRule[], api: IExtensionApi): Promise<IDependency[]> {
  const state = api.store.getState();
  const requirements: IRule[] =
      rules === undefined ?
          [] :
          rules.filter((rule: IRule) => rule.type === 'requires');

  // for each requirement, look up the reference and recursively their dependencies
  return Promise.reduce(requirements, (total: IDependency[], rule: IRule) => {
    if (findModByRef(rule.reference, state)) {
      return total;
    }

    let lookupDetails: ILookupResult[];

    return api.lookupModReference(rule.reference)
        .then((details: ILookupResult[]) => {
          lookupDetails = details;

          if ((details.length === 0) || (details[0].value === undefined)) {
            throw new Error('reference not found: ' + rule.reference);
          }

          return gatherDependencies(details[0].value.rules, api);
        })
        .then((dependencies: IDependency[]) => {
          return total.concat(dependencies)
              .concat([
                {
                  download: findDownloadByRef(rule.reference, state),
                  reference: rule.reference,
                  lookupResults: lookupDetails,
                },
              ]);
        })
        .catch((err) => {
          log('error', 'failed to look up', err.message);
          return total;
        });
  }, []);
}

export default gatherDependencies;
