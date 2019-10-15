import { truthy } from '../../../util/util';

import { IMod, IModReference } from '../types/IMod';

import minimatch from 'minimatch';
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
}

function testRef(mod: IModLookupInfo, modId: string, ref: IModReference): boolean {
  if ((ref.id !== undefined)
    && (ref.id !== modId)) {
    return false;
  }

  // if reference is by file hash, use only that
  if ((ref.fileMD5 !== undefined)
      && (mod.fileMD5 !== ref.fileMD5)) {
    return false;
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
      const baseName = path.basename(mod.fileName, path.extname(mod.fileName));
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
      if ((mod.version !== ref.versionMatch)
        && !semver.satisfies(semver.coerce(mod.version), ref.versionMatch, true)) {
        return false;
      }
    } else {
      // if the version number can't be interpreted then we can only do an exact match
      if (mod.version !== ref.versionMatch) {
        return false;
      }
    }
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
