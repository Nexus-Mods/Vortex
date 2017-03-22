import * as minimatch from 'minimatch';
import { IReference } from 'modmeta-db';
import { types } from 'nmm-api';
import { satisfies } from 'semvish';

function matchReference(reference: IReference, mod: types.IMod) {
  // tslint:disable:no-string-literal
  if ((reference.fileMD5 !== undefined) &&
      (reference.fileMD5 !== mod.attributes['fileMD5'])) {
    return false;
  }
  if ((reference.modId !== undefined) &&
      (reference.modId !== mod.attributes['modId'])) {
    return false;
  }
  if ((reference.logicalFileName !== undefined) &&
      (reference.logicalFileName !== mod.attributes['logicalFileName'])) {
    return false;
  }
  if ((reference.fileExpression !== undefined) &&
      !minimatch(mod.attributes['fileName'], reference.fileExpression)) {
    return false;
  }
  if ((reference.versionMatch !== undefined) &&
      !satisfies(mod.attributes['version'], reference.versionMatch, true)) {
    return false;
  }
  return true;
  // tslint:enable:no-string-literal
}

export default matchReference;
