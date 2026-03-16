/* eslint-disable */
import * as semver from 'semver';

import { actions, log, types } from 'vortex-api';

import { SMAPI_QUERY_FREQUENCY } from '../constants';
import { errorMessage } from '../helpers';
import SMAPIProxy from '../smapiProxy';
import { compatibilityOptions, CompatibilityStatus, ISMAPIResult } from '../types';

/**
 * Compatibility metadata updater for installed mods.
 *
 * Queries SMAPI metadata for a given mod and writes compatibility attributes to
 * the Redux store so they can be displayed in the mods table.
 */
export function updateConflictInfo(api: types.IExtensionApi,
                                   smapi: SMAPIProxy,
                                   gameId: string,
                                   modId: string)
                                   : Promise<void> {
  const gameMods = api.getState().persistent.mods[gameId];
  if (gameMods === undefined) {
    return Promise.resolve();
  }

  const mod = gameMods[modId];

  if (mod === undefined) {
    return Promise.resolve();
  }

  const now = Date.now();
  const store = api.store;
  if (store === undefined) {
    return Promise.resolve();
  }

  if ((now - (mod.attributes?.lastSMAPIQuery ?? 0)) < SMAPI_QUERY_FREQUENCY) {
    return Promise.resolve();
  }

  let additionalLogicalFileNames = mod.attributes?.additionalLogicalFileNames;
  if (!additionalLogicalFileNames) {
    if (mod.attributes?.logicalFileName) {
      additionalLogicalFileNames = [mod.attributes?.logicalFileName];
    } else {
      additionalLogicalFileNames = [];
    }
  }

  const query = additionalLogicalFileNames
    .map(name => {
      const res = {
        id: name,
      };
      const ver = mod.attributes?.manifestVersion
        ?? semver.coerce(mod.attributes?.version)?.version;
      if (!!ver) {
        res['installedVersion'] = ver;
      }

      return res;
    });

  const stat = (item: ISMAPIResult): CompatibilityStatus => {
    const status = item.metadata?.compatibilityStatus?.toLowerCase?.();
    if (!compatibilityOptions.includes(status as any)) {
      return 'unknown';
    } else {
      return status as CompatibilityStatus;
    }
  };

  const compatibilityPrio = (item: ISMAPIResult) => compatibilityOptions.indexOf(stat(item));

  return smapi.findByNames(query)
    .then(results => {
      const worstStatus = results
        .sort((lhs, rhs) => compatibilityPrio(lhs) - compatibilityPrio(rhs))[0];
      if (worstStatus !== undefined) {
        store.dispatch(actions.setModAttributes(gameId, modId, {
          lastSMAPIQuery: now,
          compatibilityStatus: worstStatus.metadata.compatibilityStatus,
          compatibilityMessage: worstStatus.metadata.compatibilitySummary,
          compatibilityUpdate: worstStatus.suggestedUpdate?.version,
        }));
      } else {
        log('debug', 'no manifest');
        store.dispatch(actions.setModAttribute(gameId, modId, 'lastSMAPIQuery', now));
      }
    })
    .catch(err => {
      log('warn', 'error reading manifest', errorMessage(err));
      store.dispatch(actions.setModAttribute(gameId, modId, 'lastSMAPIQuery', now));
    });
}
