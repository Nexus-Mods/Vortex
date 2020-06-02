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
import minimatch from 'minimatch';
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

function lookupFulfills(lookup: ILookupResult, reference: IReference) {
  const {
    fileExpression, fileMD5, fileSize, gameId, logicalFileName, versionMatch,
  } = reference;
  const { value } = lookup;
  return ((gameId === undefined) || (gameId === value.gameId))
      && ((fileMD5 === undefined) || (fileMD5 === value.fileMD5))
      && ((fileSize === undefined) || (fileSize === value.fileSizeBytes))
      && ((logicalFileName === undefined) || (logicalFileName === value.logicalFileName))
      && ((fileExpression === undefined) || minimatch(value.fileName, fileExpression))
      && ((versionMatch === undefined) || semver.satisfies(value.fileVersion, versionMatch));
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
        // within blocks of equal number of collaterals, consider the newer versions
        // before the ones with lower version
        return semver.compare(
          rhs.dep.lookupResults[0].value.fileVersion,
          lhs.dep.lookupResults[0].value.fileVersion,
        );
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

interface IDependencyNode extends IDependency {
  dependencies: IDependencyNode[];
  redundant: boolean;
}

function gatherDependenciesGraph(
  rule: IRule,
  api: IExtensionApi,
): Promise<IDependencyNode> {
  let lookupDetails: ILookupResult[];

  return api
    .lookupModReference(rule.reference)
    .then((details: ILookupResult[]) => {
      lookupDetails = details;

      if (details.length === 0 || details[0].value === undefined) {
        throw new Error(
          'reference not found: ' + JSON.stringify(rule.reference),
        );
      }

      const { rules } = details[0].value;
      return Promise.all(
        (rules || [])
          .map(subRule => gatherDependenciesGraph(subRule, api)))
        .then(nodes => {
          const res: IDependencyNode = {
            download: findDownloadByRef(rule.reference, api.getState()),
            reference: rule.reference,
            lookupResults: details,
            dependencies: nodes.filter(node => node !== null),
            redundant: false,
          };
          return res;
        });
    })
    .catch(err => {
      log('error', 'failed to look up', err.message);
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

function gatherDependencies(
  rules: IRule[],
  api: IExtensionApi,
): Promise<IDependency[]> {
  const state = api.store.getState();
  const requirements: IRule[] =
    rules === undefined
      ? []
      : rules.filter(
          (rule: IRule) =>
            rule.type === 'requires' &&
            findModByRef(rule.reference, state) === undefined,
        );

  // for each requirement, look up the reference and recursively their dependencies
  return Promise.all(
    requirements
      .map((rule: IRule) => gatherDependenciesGraph(rule, api)),
  )
    .then((nodes: IDependencyNode[]) => {
      // tag duplicates
      return tagDuplicates(flatten(nodes)).then(() => nodes);
    })
    .then((nodes: IDependencyNode[]) =>
      // this filters out the duplicates including their subtrees,
      // then converts IDependencyNodes to IDependencies
      flatten(nodes).map(node => _.omit(node, ['dependencies', 'redundant'])),
    );
}

export default gatherDependencies;
