import { IModLookupInfo } from '../types/IModLookupInfo';

import * as minimatch from 'minimatch';
import { IReference } from 'modmeta-db';
import * as path from 'path';
import { eq, satisfies, valid } from 'semvish';
import { types } from 'vortex-api';

function matchReferenceLookup(reference: IReference, mod: IModLookupInfo) {
  if ((reference.fileMD5 !== undefined) &&
      (reference.fileMD5 !== mod.fileMD5)) {
    return false;
  }
  if ((reference.logicalFileName !== undefined) &&
      (reference.logicalFileName !== mod.logicalFileName)) {
    return false;
  }
  if (reference.fileExpression !== undefined) {
    if (mod.fileName === undefined) {
      if (mod.name !== reference.fileExpression) {
        return false;
      }
    } else {
      if (!minimatch(mod.fileName, reference.fileExpression)) {
        return false;
      }
    }
  }
  if ((reference.versionMatch !== undefined) && (mod.version !== undefined)) {
    if (valid(mod.version)) {
      // this is a bit crappy by semvish: it will report a version like 1.2 as valid,
      // but calling "satisfies('1.2', '1.2', true)" returns false
      if ((mod.version !== reference.versionMatch)
          && !satisfies(mod.version, reference.versionMatch, true)) {
        return false;
      }
    } else {
      // if the version number can't be interpreted then we can only do an exact match
      if (mod.version !== reference.versionMatch) {
        return false;
      }
    }
  }
  return true;
}

function matchReference(reference: IReference, mod: types.IMod | IModLookupInfo) {
  if ((mod as any).attributes) {
    return matchReferenceLookup(reference, (mod as types.IMod).attributes as IModLookupInfo);
  } else {
    return matchReferenceLookup(reference, mod as IModLookupInfo);
  }
}

export default matchReference;
