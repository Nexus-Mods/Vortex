import { IExtensionApi } from '../../../types/IExtensionContext';
import { log } from '../../../util/log';
import { getSafe } from '../../../util/storeHelper';

import { IMod } from '../types/IMod';

import * as Promise from 'bluebird';
import { alg, Graph } from 'graphlib';
import { ILookupResult, IReference, IRule, RuleType } from 'modmeta-db';
import * as semver from 'semvish';

interface IBiRule {
  subject: string;
  object: string;
  type: RuleType;
}

function testRef(mod: IMod, ref: IReference): boolean {
  const attr: any = mod.attributes;
  // if reference is by file hash, use only that
  if (ref.fileMD5 !== undefined) {
    return attr.fileMD5 === ref.fileMD5;
  }

  // right file?
  if (((ref.logicalFileName !== undefined) &&
       (ref.logicalFileName !== attr.logicalFileName)) ||
      (!new RegExp(ref.fileExpression).test(mod.installationPath))) {
    return false;
  }

  // right version?
  return semver.satisfies(attr.version, ref.versionMatch);
}

function findByRef(mods: IMod[], reference: IReference): IMod {
  return mods.find((mod: IMod) => testRef(mod, reference));
}

function sortMods(gameId: string, mods: IMod[], api: IExtensionApi): Promise<string[]> {
  const dependencies = new Graph();

  const modMapper = (mod: IMod) => {
    return api.lookupModMeta({
                fileMD5: mod.attributes['fileMD5'],
                fileSize: mod.attributes['size'],
                gameId,
              })
        .then((metaInfo: ILookupResult[]) => {
          const rules = [].concat(
            getSafe(metaInfo, [0, 'value', 'rules'], []),
            mod.rules || []);
          rules.forEach((rule: IRule) => {
            const ref = findByRef(mods, rule.reference);
            if (ref !== undefined) {
              if (rule.type === 'before') {
                dependencies.setEdge(mod.id, ref.id);
              } else if (rule.type === 'after') {
                dependencies.setEdge(ref.id, mod.id);
              }
            }
          });
          return Promise.resolve();
        });
  };

  mods.forEach((mod: IMod) => { dependencies.setNode(mod.id); });

  return Promise.map(mods, modMapper)
      .catch((err: Error) => {
        log('error', 'failed to sort mods',
            {msg: err.message, stack: err.stack});
      })
      .then(() => Promise.resolve(alg.topsort(dependencies)));
}

export default sortMods;
