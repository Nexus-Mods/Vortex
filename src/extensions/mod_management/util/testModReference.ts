import { truthy } from '../../../util/util';

import * as minimatch from 'minimatch';
import { IReference } from 'modmeta-db';
import * as path from 'path';
import * as semver from 'semvish';
import { IMod } from '../types/IMod';

export interface IModLookupInfo {
  id: string;
  fileMD5: string;
  fileSizeBytes: number;
  fileName: string;
  name?: string;
  logicalFileName?: string;
  customFileName?: string;
  version: string;
}

function testRef(mod: IModLookupInfo, ref: IReference): boolean {
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
      if (!minimatch(baseName, ref.fileExpression)) {
        return false;
      }
    }
  }

  // right version?
  if ((ref.versionMatch !== undefined)
      && (ref.versionMatch !== '*')
      && truthy(mod.version)) {
    if (semver.valid(mod.version)) {
      // this is a bit crappy by semvish: it will report a version like 1.2 as valid,
      // but calling "satisfies('1.2', '1.2', true)" returns false.
      // hence, try an exact match first
      if ((mod.version !== ref.versionMatch)
        && !semver.satisfies(mod.version, ref.versionMatch, true)) {
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

export function testModReference(mod: IMod | IModLookupInfo, reference: IReference) {
  if ((mod as any).attributes) {
    return testRef((mod as IMod).attributes as IModLookupInfo, reference);
  } else {
    return testRef(mod as IModLookupInfo, reference);
  }
}

export default testModReference;
