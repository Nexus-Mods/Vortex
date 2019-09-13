import * as path from 'path';
import { IMod, IReference } from '../types/IMod';
import { sanitizeExpression } from './testModReference';

export function makeModReference(mod: IMod): IReference {
  if ((mod.attributes['fileMD5'] === undefined)
      && (mod.attributes['logicalFileName'] === undefined)
      && (mod.attributes['fileName'] === undefined)) {
    // if none of the usual markers are available, use just the mod name
    return {
      fileExpression: mod.attributes['name'],
    };
  }

  const fileName = mod.attributes['fileName'];

  return {
    fileExpression: (fileName !== undefined)
      ? sanitizeExpression(fileName)
      : undefined,
    fileMD5: mod.attributes['fileMD5'],
    versionMatch: mod.attributes['version'],
    logicalFileName: mod.attributes['logicalFileName'],
  };
}
