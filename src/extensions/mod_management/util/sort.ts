import { showDialog } from '../../../actions';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { log } from '../../../util/log';
import { getSafe } from '../../../util/storeHelper';

import { IMod } from '../types/IMod';

import testModReference from './testModReference';

import * as Promise from 'bluebird';
import { alg, Graph } from 'graphlib';
import { ILookupResult, IReference, IRule, RuleType } from 'modmeta-db';

interface IBiRule {
  subject: string;
  object: string;
  type: RuleType;
}

function findByRef(mods: IMod[], reference: IReference): IMod {
  return mods.find((mod: IMod) => testModReference(mod, reference));
}

function showCycles(api: IExtensionApi, cycles: string[][]) {
  api.store.dispatch(showDialog('error', 'Cycles', {
    text: 'Dependency rules between your mods contain cycles, '
      + 'like "A after B" and "B after A". You need to remove one of the '
      + 'rules causing the cycle, otherwise your mods can\'t be '
      + 'applied in the right order.',
    links: cycles.map((cycle, idx) => (
      { label: cycle.join(', '), action: () => {
        api.events.emit('edit-mod-cycle', cycle);
      } }
    )),
  }, [
    { label: 'Close' },
  ]));
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
          api.sendNotification({
            type: 'warning',
            message: 'Mod rules contain cycles',
            actions: [
              { title: 'Show', action: () => {
                showCycles(api, alg.findCycles(dependencies));
              } },
            ],
          });
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
