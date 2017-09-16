import { IExtensionApi } from '../../../types/IExtensionContext';
import { log } from '../../../util/log';
import { getSafe } from '../../../util/storeHelper';

import { IMod } from '../types/IMod';

import * as Promise from 'bluebird';
import { alg, Graph } from 'graphlib';
import * as minimatch from 'minimatch';
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
      ((ref.fileExpression !== undefined) &&
       !minimatch(mod.installationPath, ref.fileExpression))) {
    return false;
  }

  // right version?
  if ((ref.versionMatch !== undefined)
      && !semver.satisfies(attr.version, ref.versionMatch)) {
    return false;
  }

  return true;
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

  mods.forEach(mod => { dependencies.setNode(mod.id); });

  return Promise.map(mods, modMapper)
      .catch((err: Error) => {
        log('error', 'failed to sort mods',
            {msg: err.message, stack: err.stack});
      })
      .then(() => {
        try {
          return Promise.resolve(alg.topsort(dependencies));
        } catch (err) {
          // exception type not included in typings
          if (err instanceof (alg.topsort as any).CycleException) {
            api.showErrorNotification('Mod rules contain cycles',
              'Dependency rules between your mods contain cycles, '
                    + 'like "A after B" and "B after A". You need to remove one of the '
                    + 'rules causing the cycle, otherwise your mods can\'t be '
                    + 'applied in the right order.<br/><ul>'
                    + renderCycles(alg.findCycles(dependencies))
                    + '</ul>'
              , { isHTML: true, allowReport: false });
            // return unsorted
            return Promise.resolve(mods.map(mod => mod.id));
          } else {
            return Promise.reject(err);
          }
        }
      });
}

function renderCycles(cycles: string[][]): string {
  return cycles.map((cycle, idx) =>
    `<li>Cycle ${idx + 1}: ${cycle.join(', ')}</li>`).join('<br />');
}

export default sortMods;
