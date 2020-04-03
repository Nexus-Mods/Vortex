import { truthy } from '../../../util/util';

import { IMod, IModReference } from '../types/IMod';

import * as _ from 'lodash';
import * as minimatch from 'minimatch';
import * as path from 'path';
import * as semver from 'semver';

export interface IModLookupInfo {
  id?: string;
  fileMD5: string;
  fileSizeBytes: number;
  fileName: string;
  name?: string;
  logicalFileName?: string;
  customFileName?: string;
  version: string;
  game?: string[];
  fileId?: string;
  modId?: string;
  source?: string;
  referenceTag?: string;
}

// test if the reference is by id only, meaning it is only useful in the current setup
function idOnly(ref: IModReference) {
  return (ref.id !== undefined) && (Object.keys(_.omit(ref, ['versionMatch'])).length === 1);
}

// these are only the "important" fields of the reference, not the "helper" fields
const REFERENCE_FIELDS = ['fileMD5', 'logicalFileName', 'fileExpression', 'versionMatch'];
export function referenceEqual(lhs: IModReference, rhs: IModReference): boolean {
  if (idOnly(lhs) || idOnly(rhs)) {
    return lhs.id === rhs.id;
  }
  return _.isEqual(_.pick(lhs, REFERENCE_FIELDS), _.pick(rhs, REFERENCE_FIELDS));
}

export function sanitizeExpression(fileName: string): string {
  // drop extension and anything like ".1" or " (1)" at the end which probaby
  // indicates duplicate downloads (either in our own format or common browser
  // style)
  return path.basename(fileName, path.extname(fileName))
    .replace(/\.\d+$/, '')
    .replace(/ \(\d+\)$/, '');
}

function isFuzzyVersion(input: string) {
  if (input === undefined) {
    return false;
  }

  return input.endsWith('+prefer')
      || (semver.validRange(input) !== input);
}

function hasIdentifyingMarker(mod: IModLookupInfo, modId: string, ref: IModReference): boolean {
  const fuzzyVersion = isFuzzyVersion(ref.versionMatch);

  return ((ref.id !== undefined) && (modId !== undefined))
      || (!fuzzyVersion && (mod.fileMD5 !== undefined))
      || ((ref.fileExpression !== undefined) && (mod.fileName !== undefined))
      || ((ref.logicalFileName !== undefined) && (mod.logicalFileName !== undefined))
      || ((ref.repo !== undefined) && (mod.source !== undefined))
      || ((ref.tag !== undefined) && (mod.referenceTag !== undefined));
}

function testRef(mod: IModLookupInfo, modId: string, ref: IModReference): boolean {
  if (!hasIdentifyingMarker(mod, modId, ref)) {
    // if the reference doesn't have any marker that _could_ match this mod,
    // return !false!, otherwise we might match any random mod that also has no matching marker
    return false;
  }

  if ((ref.tag !== undefined) && (mod.referenceTag === ref.tag)) {
    return true;
  }

  if ((ref.id !== undefined)
      && ((modId !== undefined) || (Object.keys(ref).length === 1))
      && (ref.id !== modId)) {
    return false;
  }

  const versionMatchSafe = ref.versionMatch || '1.0.0';

  // if reference is by file hash and the match , use only that
  if ((ref.fileMD5 !== undefined)
      && !versionMatchSafe.endsWith('+prefer')
      && (semver.validRange(versionMatchSafe) === versionMatchSafe)
      && (mod.fileMD5 !== ref.fileMD5)) {
    return false;
  }

  if (ref.repo !== undefined) {
    return (ref.repo.repository === mod.source)
        && (ref.repo.modId === (mod.modId || -1).toString())
        && (ref.repo.fileId === (mod.fileId || -1).toString());
  }

  // right file?
  if ((ref.logicalFileName !== undefined)
    && (ref.logicalFileName !== mod.logicalFileName)) {
    return false;
  }

  if (ref.fileExpression !== undefined) {
    // file expression is either an exact match against the mod name or
    // a glob match against the archive name (without file extension)
    if (mod.fileName === undefined) {
      if (mod.name !== ref.fileExpression) {
        return false;
      }
    } else {
      const baseName = sanitizeExpression(mod.fileName);
      if ((baseName !== ref.fileExpression) &&
          !minimatch(baseName, ref.fileExpression)) {
        return false;
      }
    }
  }

  // right version?
  if ((ref.versionMatch !== undefined)
      && (ref.versionMatch !== '*')
      && truthy(mod.version)) {
    if (semver.valid(semver.coerce(mod.version))) {
      let versionMatch = ref.versionMatch.split('+')[0];
      if ((mod.version !== ref.versionMatch)
        && !semver.satisfies(semver.coerce(mod.version), versionMatch, true)) {
        return false;
      }
    } else {
      // if the version number can't be interpreted then we can only do an exact match
      if (mod.version !== ref.versionMatch) {
        return false;
      }
    }
  }

  // right game?
  if ((ref.gameId !== undefined)
      && (mod.game !== undefined)
      && (mod.game.indexOf(ref.gameId) === -1)) {
    return false;
  }

  return true;
}

export function testModReference(mod: IMod | IModLookupInfo, reference: IModReference) {
  if (mod === undefined) {
    return false;
  }

  if ((mod as any).attributes) {
    return testRef((mod as IMod).attributes as IModLookupInfo, mod.id, reference);
  } else {
    const lookup = mod as IModLookupInfo;
    return testRef(lookup, lookup.id, reference);
  }
}

export default testModReference;
