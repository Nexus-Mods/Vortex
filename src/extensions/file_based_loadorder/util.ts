import * as types from '../../types/api';
import * as util from '../../util/api';
import { findGameEntry } from './gameSupport';
import { ILoadOrderGameInfoExt, IValidationResult,
  LoadOrderSerializationError, LoadOrderValidationError } from './types/types';

export function isModInCollection(collection: types.IMod, mod: types.IMod) {
  if (collection.rules === undefined) {
    return false;
  }

  return collection.rules.find(rule =>
    util.testModReference(mod, rule.reference)) !== undefined;
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
  const allowReport = !gameEntry.isContributed;
  if (err instanceof LoadOrderValidationError) {
    const invalLOErr = err as LoadOrderValidationError;
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
