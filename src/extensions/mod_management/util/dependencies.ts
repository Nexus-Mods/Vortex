import {IExtensionContext} from '../../../types/IExtensionContext';
import {log} from '../../../util/log';
import {getSafe} from '../../../util/storeHelper';

import {IDependency} from '../types/IDependency';

import * as Promise from 'bluebird';
import {ILookupResult, IReference, IRule} from 'modmeta-db';

function findModByRef(reference: IReference, state: any): string {
  // TODO support non-hash references
  const mods = state.mods.mods;
  let existing: string = Object.keys(mods).find((modId: string): boolean => {
    return getSafe(mods[modId], ['attributes', 'fileMD5'], undefined) === reference.fileMD5;
  });
  return existing;
}

function findDownloadByRef(reference: IReference, state: any): string {
  // TODO support non-hash references
  const downloads = state.downloads.files;
  let existing: string = Object.keys(downloads).find((dlId: string): boolean => {
    return downloads[dlId].fileMD5 === reference.fileMD5;
  });
  return existing;
}

function gatherDependencies(
    rules: IRule[], context: IExtensionContext): Promise<IDependency[]> {
  const state = context.api.store.getState();
  let requirements: IRule[] =
      rules === undefined ?
          [] :
          rules.filter((rule: IRule) => { return rule.type === 'requires'; });

  // for each requirement, look up the reference and recursively their dependencies
  return Promise.reduce(requirements, (total: IDependency[], rule: IRule) => {
    if (findModByRef(rule.reference, state)) {
      return total;
    }

    let lookupDetails: ILookupResult[];

    return context.api.lookupModReference(rule.reference)
        .then((details: ILookupResult[]) => {
          lookupDetails = details;

          if (details.length === 0) {
            throw new Error('reference not found: ' + rule.reference);
          }

          return gatherDependencies(details[0].value.rules, context);
        })
        .then((dependencies: IDependency[]) => {
          return total.concat(dependencies)
              .concat([
                {
                  download: findDownloadByRef(rule.reference, state),
                  reference: rule.reference,
                  lookupResults: lookupDetails,
                },
              ]);
        })
        .catch((err) => {
          log('error', 'failed to look up', err.message);
          return total;
        });
  }, []);
}

export default gatherDependencies;
