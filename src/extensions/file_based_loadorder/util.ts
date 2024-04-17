/* eslint-disable */
import * as types from '../../types/api';
import * as util from '../../util/api';
import { lastActiveProfileForGame } from '../profile_management/selectors';
import { findGameEntry } from './gameSupport';
import { ILoadOrderGameInfoExt, IValidationResult, LoadOrder,
  LoadOrderSerializationError, LoadOrderValidationError } from './types/types';

import { setValidationResult } from './actions/session'

export function isModInCollection(collection: types.IMod, mod: types.IMod) {
  if (collection.rules === undefined) {
    return false;
  }

  return collection.rules.find(rule =>
    util.testModReference(mod, rule.reference)) !== undefined;
}

export async function genCollectionLoadOrder(api: types.IExtensionApi,
                                             gameEntry: ILoadOrderGameInfoExt,
                                             mods: { [modId: string]: types.IMod },
                                             profileId: string,
                                             collection?: types.IMod): Promise<LoadOrder> {
  const state = api.getState();
  let loadOrder: LoadOrder = [];
  try {
    const prev = util.getSafe(state, ['persistent', 'loadOrder', profileId], []);
    loadOrder = await gameEntry.deserializeLoadOrder();
    loadOrder = loadOrder.filter(entry => (collection !== undefined)
      ? isValidMod(mods[entry.modId]) && (isModInCollection(collection, mods[entry.modId]))
      : isValidMod(mods[entry.modId]));
    const validRes: IValidationResult = await gameEntry.validate(prev, loadOrder);
    assertValidationResult(validRes);
    if (validRes !== undefined) {
      throw new LoadOrderValidationError(validRes, loadOrder);
    }
  } catch (err) {
    return Promise.reject(err);
  }

  return Promise.resolve(loadOrder);
}

export function isValidMod(mod: types.IMod) {
  return (mod !== undefined) && (mod.type !== 'collection');
}

function reportError(api: types.IExtensionApi,
                     errorMessage: string,
                     errDetails: any,
                     allowReport: boolean = true) {
  const errorId = errorMessage + 'notifId';
  api.showErrorNotification(errorMessage, errDetails, { allowReport, id: errorId });
}

export async function errorHandler(api: types.IExtensionApi,
                                   gameId: string,
                                   err: Error) {
  const gameEntry: ILoadOrderGameInfoExt = findGameEntry(gameId);
  const allowReport = !gameEntry.isContributed
    && !(err instanceof util.ProcessCanceled)
    && !(err instanceof util.DataInvalid)
    && !(err instanceof util.UserCanceled);
  if (err instanceof LoadOrderValidationError) {
    const invalLOErr = err as LoadOrderValidationError;
    const profileId = lastActiveProfileForGame(api.getState(), gameId);
    api.store.dispatch(setValidationResult(profileId, invalLOErr.validationResult));
    const errorMessage = 'Load order failed validation';
    const details = {
      message: errorMessage,
      loadOrder: invalLOErr.loadOrderEntryNames,
      reasons: invalLOErr.validationResult.invalid.map(invl => `${invl.id} - ${invl.reason}\n`),
    };
    reportError(api, errorMessage, details, allowReport);
  } else if (err instanceof LoadOrderSerializationError) {
    const serErr = err as LoadOrderSerializationError;
    const errMess = 'Failed to serialize load order';
    const details = {
      loadOrder: serErr.loadOrder,
    };
    reportError(api, errMess, details, allowReport);
  } else {
    reportError(api, 'Failed load order operation', err, allowReport);
  }

  return Promise.resolve();
}

export function assertValidationResult(validRes: any) {
  if (validRes === undefined) {
    return;
  }
  if ((Array.isArray(validRes)) || (validRes as IValidationResult)?.invalid === undefined) {
    throw new TypeError('Received incorrect/invalid return type from validation function; '
      + 'expected object of type IValidationResult');
  }
}
