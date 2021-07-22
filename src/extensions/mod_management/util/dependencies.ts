import {IExtensionApi} from '../../../types/IExtensionContext';
import { IDownload } from '../../../types/IState';
import { NotFound, ProcessCanceled } from '../../../util/CustomErrors';

import { IDependency, ILookupResultEx } from '../types/IDependency';
import { IDownloadHint, IFileListItem, IMod, IModReference, IModRule } from '../types/IMod';

import ConcurrencyLimiter from '../../../util/ConcurrencyLimiter';
import {log} from '../../../util/log';
import {activeGameId} from '../../../util/selectors';
import {getSafe} from '../../../util/storeHelper';
import { semverCoerce, truthy } from '../../../util/util';

import Promise from 'bluebird';
import * as _ from 'lodash';
import minimatch from 'minimatch';
import {ILookupResult, IReference, IRule} from 'modmeta-db';
import normalizeUrl from 'normalize-url';
import * as semver from 'semver';
import testModReference, { IModLookupInfo, isFuzzyVersion } from './testModReference';

interface IBrowserResult {
  url: string | (() => Promise<string>);
  referer?: string | (() => Promise<string>);
}

export function findModByRef(reference: IModReference, mods: { [modId: string]: IMod },
                             source?: { gameId: string, modId: string }): IMod {
  const fuzzy = isFuzzyVersion(reference.versionMatch);
  if ((reference['idHint'] !== undefined)
      && (testModReference(mods[reference['idHint']], reference, source, fuzzy))) {
    // fast-path if we have an id from a previous match
    return mods[reference['idHint']];
  }

  if (reference['md5Hint'] !== undefined) {
    const result = Object.keys(mods)
      .find(dlId => mods[dlId].attributes.fileMD5 === reference['md5Hint']);
    if (result !== undefined) {
      return mods[result];
    }
  }

  if ((reference.versionMatch !== undefined)
      && isFuzzyVersion(reference.versionMatch)
      && (reference.fileMD5 !== undefined)
      && ((reference.logicalFileName !== undefined)
          || (reference.fileExpression !== undefined))) {
    reference = _.omit(reference, ['fileMD5']);
  }

  return Object.values(mods).find((mod: IMod): boolean =>
    testModReference(mod, reference, source, fuzzy));
}

function newerSort(lhs: IDownload, rhs: IDownload): number {
  const lVersion = semver.coerce(getSafe(lhs, ['modInfo', 'version'], undefined));
  const rVersion = semver.coerce(getSafe(rhs, ['modInfo', 'version'], undefined));

  if ((lVersion !== null) && (rVersion !== null)) {
    return semver.compare(rVersion, lVersion);
  }

  return rhs.fileTime - lhs.fileTime;
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
          .then((resultList: string[]) => {
            if (resultList.length === 0) {
              return undefined;
            }
            const [dlUrl, referer] = resultList[0].split('<');
            return { url: dlUrl, referer };
          });
      }
      return lookupResult;
    };

    return resolve({
      url: () => doLookup().then(out => Promise.resolve(out?.url)),
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
    return Promise.resolve({ url: normalizeUrl(input.url, { defaultProtocol: 'https:' }) });
  } else if (input.mode === 'browse') {
    return browseForDownload(api,
      normalizeUrl(input.url, { defaultProtocol: 'https:' }), input.instructions)
      .then(result => {
        if (result === undefined) {
          return Promise.reject(new NotFound('No download found browsing url'));
        } else {
          return Promise.resolve(result);
        }
      });
  } else {
    return Promise.reject(new ProcessCanceled(input.instructions));
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

function lookupFulfills(lookup: ILookupResult, reference: IReference) {
  const {
    fileExpression, fileMD5, fileSize, gameId, logicalFileName, versionMatch,
  } = reference;
  if (lookup === undefined) {
    return false;
  }
  const { value } = lookup;
  return ((gameId === undefined) || (gameId === value.gameId))
      && ((fileMD5 === undefined) || (fileMD5 === value.fileMD5))
      && ((fileSize === undefined) || (fileSize === value.fileSizeBytes))
      && ((logicalFileName === undefined) || (logicalFileName === value.logicalFileName))
      && ((fileExpression === undefined) || minimatch(value.fileName, fileExpression))
      && ((versionMatch === undefined)
          || semver.satisfies(semver.coerce(value.fileVersion), versionMatch));
}

function tagDuplicates(input: IDependencyNode[]): Promise<IDependencyNode[]> {
  // for all dependencies, figure out which of the other dependencies
  // would be solved by the same lookup result, sorted by the number of
  // collaterals it would fulfill
  const temp = input
    .map(dep => ({
      dep,
      collateral: input.filter(
        inner =>
          inner !== dep &&
          lookupFulfills(dep.lookupResults[0], inner.reference),
      ),
    }))
    .sort((lhs, rhs) => {
      if (lhs.collateral.length !== rhs.collateral.length) {
        return rhs.collateral.length - lhs.collateral.length;
      } else {
        const fileVerL = lhs.dep.lookupResults[0]?.value?.fileVersion ?? '0.0.1';
        const fileVerR = rhs.dep.lookupResults[0]?.value?.fileVersion ?? '0.0.1';
        try {
        // within blocks of equal number of collaterals, consider the newer versions
        // before the ones with lower version
        return semver.compare(semverCoerce(fileVerR), semverCoerce(fileVerL));
        } catch (err) {
          log('error', 'failed to compare version', { lhs: fileVerL, rhs: fileVerR });
          return fileVerR.localeCompare(fileVerL);
        }
      }
    });

  // now starting with the largest set of "collateral" fulfillments filter
  // those from the result
  // theoretically this may not produce ideal results, multiple smaller sets may eliminate
  // more collaterals than one large set but in practice I don't think this is going to be
  // relevant.
  // If this turns out to be a real problem, a much more complex recursive algorithm will
  // be necessary but I believe that to be very hypothetical.

  // tslint:disable-next-line:prefer-for-of
  for (let i = 0; i < temp.length; ++i) {
    if (!temp[i].dep.redundant) {
      temp[i].collateral.forEach(collateralItem => {
        // we can't store the index before because the list got sorted in the meantime
        // so we have to go searching for each collateral again
        const collateralIdx = temp.findIndex(iter => iter.dep === collateralItem);
        // tag items as redundant, this way they will get filtered out later, including
        // their own dependencies
        temp[collateralIdx].dep.redundant = true;
      });
    }
  }

  return Promise.resolve(temp.filter(iter => iter !== null).map(iter => iter.dep));
}

export function lookupFromDownload(download: IDownload): IModLookupInfo {
  // depending on where Vortex got the id (metadb, rest api or graph api and in which version,
  // the modid/fileid may be stored in differenent places).
  // Newer versions should be more consistent but existing downloads may still be messy
  const modId = download.modInfo?.meta?.details?.modId
              ?? download.modInfo?.nexus?.ids?.modId
              ?? download.modInfo?.ids?.modId;

  const fileId = download.modInfo?.meta?.details?.fileId
              ?? download.modInfo?.nexus?.ids?.fileId
              ?? download.modInfo?.ids?.fileId;

  return {
    fileMD5: download.fileMD5,
    fileName: download.localPath,
    fileSizeBytes: download.size,
    version: download.modInfo?.version ?? download.modInfo.meta?.fileVersion,
    logicalFileName: download.modInfo?.name ?? download.modInfo.meta?.logicalFileName,
    game: download.game,
    source: download.modInfo?.source,
    referenceTag: download.modInfo?.referenceTag,
    modId,
    fileId,
  };
}

export function findDownloadByRef(reference: IReference,
                                  downloads: { [dlId: string]: IDownload }): string {

  if (reference['md5Hint'] !== undefined) {
    const result = Object.keys(downloads)
      .find(dlId => downloads[dlId].fileMD5 === reference['md5Hint']);
    if (result !== undefined) {
      return result;
    }
  }

  if (isFuzzyVersion(reference.versionMatch)
    && (reference.fileMD5 !== undefined)
    && ((reference.logicalFileName !== undefined)
      || (reference.fileExpression !== undefined))) {
    reference = _.omit(reference, ['fileMD5']);
  }

  try {
    const fuzzy = isFuzzyVersion(reference.versionMatch);

    const existing: string[] = Object.keys(downloads).filter((dlId: string): boolean => {
      const download: IDownload = downloads[dlId];
      return testModReference(lookupFromDownload(download), reference, undefined, fuzzy);
    })
      .sort((lhs, rhs) => newerSort(downloads[lhs], downloads[rhs]));
    return existing[0];
  } catch (err) {
    return undefined;
  }
}

interface IDependencyNode extends IDependency {
  dependencies: IDependencyNode[];
  redundant: boolean;
  fileList?: IFileListItem[];
  installerChoices?: any;
}

function gatherDependenciesGraph(
  rule: IModRule,
  api: IExtensionApi,
  recommendations: boolean,
): Promise<IDependencyNode> {
  const state = api.getState();

  const download = findDownloadByRef(rule.reference, state.persistent.downloads.files);
  if (download === undefined) {
    log('debug', 'no download found', { ref: JSON.stringify(rule.reference) });
  }
  let lookupResults: ILookupResult[];

  let urlFromHint: IBrowserResult;

  const limit = new ConcurrencyLimiter(10);

  return ((download !== undefined)
              ? Promise.resolve(undefined)
              : lookupDownloadHint(api, rule.downloadHint))
    .then(res => {
      urlFromHint = truthy(res) ? res : undefined;

      return api.lookupModReference(rule.reference, { requireURL: true });
    })
    .then((details: ILookupResult[]) => {
      lookupResults = details;

      const rules = details?.[0]?.value?.rules || [];

      return Promise.all(rules
          .map(subRule => limit.do(() => gatherDependenciesGraph(subRule, api, recommendations))));
    })
    .then(nodes => {
      const res: IDependencyNode = {
        download,
        reference: rule.reference,
        lookupResults: (lookupResults.length > 0)
          ? lookupResults.map(iter => makeLookupResult(iter, urlFromHint))
          : (urlFromHint !== undefined)
          ? [{
            key: 'from-download-hint', value: {
              fileName: rule.reference.logicalFileName,
              fileSizeBytes: rule.reference.fileSize,
              gameId: rule.reference.gameId,
              domainName: rule.reference.gameId,
              fileVersion: undefined,
              fileMD5: rule.reference.fileMD5,
              sourceURI: urlFromHint.url,
              referer: urlFromHint.referer,
            },
          }]
          : [],
        dependencies: nodes.filter(node => node !== null),
        redundant: false,
        extra: rule.extra,
        installerChoices: rule.installerChoices,
        fileList: rule.fileList,
      };
      return res;
    })
    .catch(err => {
      if (!(err instanceof ProcessCanceled)) {
        log('error', 'failed to look up',
            { rule: JSON.stringify(rule), ex: err.name, message: err.message, stack: err.stack });
      }
      return null;
    });
}

function flatten(nodes: IDependencyNode[]): IDependencyNode[] {
  return nodes.reduce((agg: IDependencyNode[], node: IDependencyNode) => {
    if ((node === null) || node.redundant) {
      return agg;
    }
    return [].concat(agg, node, flatten(node.dependencies));
  }, []);
}

/**
 * from a set of requires/recommends rules, deduce which of them need to be downloaded
 * and/or installed
 * @param rules
 * @param api
 * @param recommendations
 */
function gatherDependencies(
  rules: IModRule[],
  api: IExtensionApi,
  recommendations: boolean,
  progressCB?: (percent: number) => void,
  modId?: string,
): Promise<IDependency[]> {
  const state = api.getState();
  const gameMode: string = activeGameId(state);
  const source = { gameId: gameMode, modId };
  const requirements: IModRule[] =
    rules === undefined
      ? []
      : rules.filter((rule: IRule) =>
          (rule.type === (recommendations ? 'recommends' : 'requires'))
          && (findModByRef(rule.reference, state.persistent.mods[gameMode], source) === undefined),
        );

  let numCompleted = 0;
  const onProgress = () => {
    ++numCompleted;
    if (progressCB !== undefined) {
      progressCB(numCompleted / requirements.length);
    }
  };

  const limit = new ConcurrencyLimiter(20);

  // for each requirement, look up the reference and recursively their dependencies
  return Promise.all(
    requirements
      .map((rule: IModRule) =>
        Promise.resolve(limit.do(() => gatherDependenciesGraph(rule, api, recommendations)))
        .then((node: IDependencyNode) => {
          onProgress();
          return node;
        })),
  )
    // tag duplicates
    .then((nodes: IDependencyNode[]) =>
      tagDuplicates(flatten(nodes)).then(() => nodes))
    .then((nodes: IDependencyNode[]) =>
      // this filters out the duplicates including their subtrees,
      // then converts IDependencyNodes to IDependencies
      flatten(nodes).map(node => _.omit(node, ['dependencies', 'redundant'])),
    );
}

export default gatherDependencies;
