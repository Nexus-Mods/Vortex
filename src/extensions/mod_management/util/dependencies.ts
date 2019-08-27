import {IExtensionApi} from '../../../types/IExtensionContext';
import { IState } from '../../../types/IState';
import {log} from '../../../util/log';
import {activeGameId} from '../../../util/selectors';

import {Dependency} from '../types/IDependency';
import { IMod } from '../types/IMod';

import testModReference from './testModReference';

import * as Promise from 'bluebird';
import {ILookupResult, IReference, IRule} from 'modmeta-db';

function findModByRef(reference: IReference, state: IState): IMod {
  const gameMode = activeGameId(state);
  const mods = state.persistent.mods[gameMode];

  return Object.values(mods).find((mod: IMod): boolean =>
    testModReference(mod, reference));
}

function findDownloadByRef(reference: IReference, state: any): string {
  // TODO: support non-hash references
  const downloads = state.persistent.downloads.files;
  const existing: string = Object.keys(downloads).find((dlId: string): boolean => {
    return downloads[dlId].fileMD5 === reference.fileMD5;
  });
  return existing;
}

function gatherDependencies(rules: IRule[],
                            api: IExtensionApi,
                            recommendations: boolean)
                            : Promise<Dependency[]> {
  const state = api.store.getState();
  const requirements: IRule[] =
      rules === undefined ?
          [] :
          rules.filter((rule: IRule) =>
            rule.type === (recommendations ? 'recommends' : 'requires'));

  // for each requirement, look up the reference and recursively their dependencies
  return Promise.reduce(requirements, (total: Dependency[], rule: IRule) => {
    if (findModByRef(rule.reference, state)) {
      return total;
    }

    let lookupDetails: ILookupResult[];

    return api.lookupModReference(rule.reference)
        .then((details: ILookupResult[]) => {
          lookupDetails = details;

          if ((details.length === 0) || (details[0].value === undefined)) {
            throw new Error('reference not found: ' + JSON.stringify(rule.reference));
          }

          return gatherDependencies(details[0].value.rules, api, recommendations);
        })
        .then((dependencies: Dependency[]) => {
          return [].concat(total, dependencies, [{
            download: findDownloadByRef(rule.reference, state),
            reference: rule.reference,
            lookupResults: lookupDetails,
            fileList: rule['fileList'],
          }]);
        })
        .catch((err: Error) => {
          log('warn', 'failed to look up', err.message);
          return [].concat(total, { error: err.message });
        });
  }, []);
}

export default gatherDependencies;
