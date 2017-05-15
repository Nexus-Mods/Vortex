import { IModLookupInfo } from '../types/IModLookupInfo';

import * as minimatch from 'minimatch';
import { IReference } from 'modmeta-db';
import { types } from 'nmm-api';
import * as path from 'path';
import { satisfies } from 'semvish';

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
  if ((reference.versionMatch !== undefined) &&
      !satisfies(mod.version, reference.versionMatch, true)) {
    return false;
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
