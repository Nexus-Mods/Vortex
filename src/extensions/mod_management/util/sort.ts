import { IExtensionApi } from '../../../types/IExtensionContext';
import { log } from '../../../util/log';
import { getSafe } from '../../../util/storeHelper';

import { downloadPathForGame } from '../../download_management/selectors';

import { IMod } from '../types/IMod';

import testModReference, { isFuzzyVersion } from './testModReference';

import Bluebird from 'bluebird';
import { alg, Graph } from 'graphlib';
import * as _ from 'lodash';
import { ILookupResult, IReference, IRule } from 'modmeta-db';
import * as path from 'path';
import { setModAttribute } from '../actions/mods';

export class CycleError extends Error {
  private mCycles: string[][];
  constructor(cycles: string[][]) {
    super('Rules contain cycles');
    this.name = this.constructor.name;
    this.mCycles = cycles;
  }
  public get cycles(): string[][] {
    return this.mCycles;
  }
}

function findByRef(mods: IMod[], reference: IReference,
                   source: { gameId: string, modId: string }): IMod {
  const fuzzy = isFuzzyVersion(reference.versionMatch);
  return mods.find((mod: IMod) => testModReference(mod, reference, source, fuzzy));
}

let sortModsCache: { id: { gameId: string, mods: IMod[] }, sorted: Bluebird<IMod[]> } = {
  id: { gameId: undefined, mods: [] }, sorted: Bluebird.resolve([]) };

function sortMods(gameId: string, mods: IMod[], api: IExtensionApi): Bluebird<IMod[]> {
  if (mods.length === 0) {
    // don't flush the cache if the input is empty
    return Bluebird.resolve([]);
  }

  if ((sortModsCache.id.gameId === gameId)
    && _.isEqual(sortModsCache.id.mods, mods)) {
    return sortModsCache.sorted;
  }

  const startTime = Date.now();
  log('info', 'sorting mods', { modCount: mods.length });

  // if the graphlib library throws a custom exception it may not contain a stack trace, so prepare
  // one we can use
  const stackErr = new Error();

  const dependencies = new Graph();
  // counting only effective rules, for mods that are actually installed
  let numRules: number = 0;

  const modMapper = (mod: IMod) => {
    let downloadGame = getSafe(mod.attributes, ['downloadGame'], gameId);
    if (Array.isArray(downloadGame)) {
      downloadGame = downloadGame[0];
    }

    const state = api.getState();
    const downloadPath = downloadPathForGame(state, downloadGame);
    const fileName = getSafe(mod.attributes, ['fileName'], undefined);
    const filePath = fileName !== undefined ? path.join(downloadPath, fileName) : undefined;
    const effectiveGameId = mod.attributes?.downloadGame || gameId;

    return api.lookupModMeta({
                fileMD5: getSafe(mod.attributes, ['fileMD5'], undefined),
                fileSize: getSafe(mod.attributes, ['fileSize'], undefined),
                filePath,
                gameId: effectiveGameId,
              })
        .catch(() => [])
        .then((metaInfo: ILookupResult[]) => {
          if ((metaInfo.length > 0) && (mod.attributes.fileMD5 === undefined)) {
            api.store.dispatch(
              setModAttribute(gameId, mod.id, 'fileMD5', metaInfo[0].value.fileMD5));
          }
          const rules = [].concat(
            getSafe(metaInfo, [0, 'value', 'rules'], []),
            mod.rules || []);
          rules.forEach((rule: IRule) => {
            const ref = findByRef(mods, rule.reference, { modId: mod.id, gameId });
            if (ref !== undefined) {
              ++numRules;
              if (rule.type === 'before') {
                dependencies.setEdge(mod.id, ref.id);
              } else if (rule.type === 'after') {
                dependencies.setEdge(ref.id, mod.id);
              }
            }
          });
          return Bluebird.resolve();
        });
  };

  mods.forEach(mod => { dependencies.setNode(mod.id); });

  const sorted = Bluebird.map(mods, modMapper)
    .catch((err: Error) => {
      log('error', 'failed to sort mods',
          {msg: err.message, stack: err.stack});
    })
    .then(() => {
      try {
        const res = alg.topsort(dependencies);
        api.dismissNotification('mod-cycle-warning');
        const lookup = mods.reduce((prev, mod) => {
          prev[mod.id] = mod;
          return prev;
        }, {});
        const elapsed = Math.floor((Date.now() - startTime) / 100) / 10;
        log('info', 'done sorting mods', { elapsed, numRules });
        return Bluebird.resolve(res.map(id => lookup[id]));
      } catch (err) {
        // exception type not included in typings
        if (err instanceof (alg.topsort as any).CycleException) {
          const res = new CycleError(alg.findCycles(dependencies));
          res.stack = stackErr.stack;
          return Bluebird.reject(res);
        } else {
          return Bluebird.reject(err);
        }
      }
    });

  sortModsCache = { id: { gameId, mods }, sorted };

  return sorted;
}

export default sortMods;
