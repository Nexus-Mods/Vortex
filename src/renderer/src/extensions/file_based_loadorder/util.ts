import { DataInvalid, ProcessCanceled, UserCanceled } from "@vortex/shared/errors";

import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IMod } from "../mod_management/types/IMod";
import { findRuleByRef } from "../mod_management/util/testModReference";
import { lastActiveProfileForGame } from "../profile_management/selectors";
import { setValidationResult } from "./actions/session";
import { loadOrderForProfile } from "./selectors";
import {
  type IRegisteredLoadOrder,
  type IValidationResult,
  type LoadOrder,
  LoadOrderSerializationError,
  LoadOrderValidationError,
  type LockedState,
} from "./types/types";

// A load order entry is locked (pinned, not user-orderable) for any of the
//  truthy LockedState values.
export function isEntryLocked(locked: LockedState): boolean {
  return locked === true || locked === "true" || locked === "always";
}

export function isModInCollection(collection: IMod, mod: IMod) {
  return findRuleByRef(collection.rules, mod) !== undefined;
}

export async function genCollectionLoadOrder(
  api: IExtensionApi,
  gameEntry: IRegisteredLoadOrder,
  // keyed by Vortex mod id
  mods: Record<string, IMod>,
  profileId: string,
  collection?: IMod,
): Promise<LoadOrder> {
  const state = api.getState();
  try {
    const prev = loadOrderForProfile(state, profileId, gameEntry.loadOrderId);
    let loadOrder = await gameEntry.deserializeLoadOrder();
    loadOrder = loadOrder.filter((entry) =>
      collection !== undefined
        ? isValidMod(mods[entry.modId]) && isModInCollection(collection, mods[entry.modId])
        : isValidMod(mods[entry.modId]),
    );
    const validRes: IValidationResult = await gameEntry.validate(prev, loadOrder);
    assertValidationResult(validRes);
    if (validRes !== undefined) {
      throw new LoadOrderValidationError(validRes, loadOrder);
    }
    return Promise.resolve(loadOrder);
  } catch (err) {
    return Promise.reject(err);
  }
}

export function isValidMod(mod: IMod) {
  return mod !== undefined && mod.type !== "collection";
}

function reportError(
  api: IExtensionApi,
  errorMessage: string,
  errDetails: any,
  allowReport: boolean = true,
) {
  const errorId = errorMessage + "notifId";
  api.showErrorNotification(errorMessage, errDetails, {
    allowReport,
    id: errorId,
  });
}

export async function errorHandler(
  api: IExtensionApi,
  gameId: string,
  gameEntry: IRegisteredLoadOrder | undefined,
  err: Error,
) {
  const allowReport =
    gameEntry?.isContributed !== true &&
    !(err instanceof ProcessCanceled) &&
    !(err instanceof DataInvalid) &&
    !(err instanceof UserCanceled);
  if (err instanceof LoadOrderValidationError) {
    const invalLOErr = err as LoadOrderValidationError;
    const profileId = lastActiveProfileForGame(api.getState(), gameId);
    api.store.dispatch(
      setValidationResult(profileId, invalLOErr.validationResult, gameEntry?.loadOrderId),
    );
    const errorMessage = "Load order failed validation";
    const details = {
      message: errorMessage,
      loadOrder: invalLOErr.loadOrderEntryNames,
      reasons: invalLOErr.validationResult.invalid.map((invl) => `${invl.id} - ${invl.reason}\n`),
    };
    reportError(api, errorMessage, details, allowReport);
  } else if (err instanceof LoadOrderSerializationError) {
    const serErr = err as LoadOrderSerializationError;
    const errMess = "Failed to serialize load order";
    const details = {
      loadOrder: serErr.loadOrder,
    };
    reportError(api, errMess, details, allowReport);
  } else {
    reportError(api, "Failed load order operation", err, allowReport);
  }

  return Promise.resolve();
}

export function assertValidationResult(validRes: any) {
  if (validRes === undefined) {
    return;
  }
  if (Array.isArray(validRes) || (validRes as IValidationResult)?.invalid === undefined) {
    throw new TypeError(
      "Received incorrect/invalid return type from validation function; " +
        "expected object of type IValidationResult",
    );
  }
}
