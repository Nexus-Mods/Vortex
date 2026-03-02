/**
 * top level reducer. This combines all reducers into one
 */

/**
 * dummy comment
 */
import type { IExtensionReducer } from "../types/extensions";
import type { IReducerSpec, IStateVerifier } from "../types/IExtensionContext";
import { VerifierDrop, VerifierDropParent } from "../types/IExtensionContext";
import { UserCanceled } from "../util/CustomErrors";
import deepMerge from "../util/deepMerge";
import * as fs from "../util/fs";
import { log } from "../util/log";
import { deleteOrNop, getSafe, rehydrate, setSafe } from "../util/storeHelper";

import { appReducer } from "./app";
import { loReducer } from "./loadOrder";
import { notificationsReducer } from "./notifications";
import { notificationSettingsReducer } from "./notificationSettings";
import { sessionReducer } from "./session";
import { tableReducer } from "./tables";
import { userReducer } from "./user";
import { windowReducer } from "./window";

import { app } from "electron";
import update from "immutability-helper";
import { pick } from "lodash";
import * as path from "path";
import type { Reducer, ReducersMapObject } from "redux";
import { combineReducers } from "redux";
import { createReducer } from "redux-act";
import { enableBatching } from "redux-batched-actions";
import type { IState } from "../types/IState";
import { unknownToError } from "@vortex/shared";

export const STATE_BACKUP_PATH = "state_backups";

/**
 * wrapper for combineReducers that doesn't drop unexpected keys
 */
function safeCombineReducers(
  reducer: ReducersMapObject,
  onError: (error: Error) => void,
) {
  const redKeys = Object.keys(reducer);
  const combined = combineReducers<Partial<IState>>(reducer);
  return (state: IState, action): IState => {
    const red = state !== undefined ? pick(state, redKeys) : undefined;
    try {
      return {
        ...state,
        ...combined(red, action),
      };
    } catch (unknownError) {
      const err = unknownToError(unknownError);
      if (action["meta"]?.["extension"] !== undefined) {
        err["extension"] = action["meta"]?.["extension"];
      }
      setImmediate(() => {
        onError?.(unknownToError(err));
      });
      return state;
    }
  };
}

function verifyElement(verifier: IStateVerifier, value: any) {
  if (
    verifier.type !== undefined &&
    (verifier.required || value !== undefined) &&
    ((verifier.type === "array" && !Array.isArray(value)) ||
      (verifier.type !== "array" && typeof value !== verifier.type))
  ) {
    return false;
  }
  if (verifier.noUndefined === true && value === undefined) {
    return false;
  }
  if (verifier.noNull === true && value === null) {
    return false;
  }
  if (verifier.noEmpty === true) {
    if (verifier.type === "array" && value.length === 0) {
      return false;
    } else if (verifier.type === "object" && Object.keys(value).length === 0) {
      return false;
    } else if (verifier.type === "string" && value.length === 0) {
      return false;
    }
  }
  return true;
}

// exported for the purpose of testing
export function verify(
  statePath: string,
  verifiers: { [key: string]: IStateVerifier } | undefined,
  input: any,
  defaults: { [key: string]: any },
  emitDescription: (description: string) => void,
): any {
  if (input === undefined || verifiers === undefined) {
    return input;
  }
  let res = input;

  const recurse = (key: string, mapKey: string) => {
    const sane = verify(
      statePath,
      verifiers[key].elements,
      res[mapKey],
      {},
      emitDescription,
    );
    if (sane !== res[mapKey]) {
      res =
        sane === undefined
          ? deleteOrNop(res, [mapKey])
          : update(res, { [mapKey]: { $set: sane } });
    }
  };

  const doTest = (key: string, realKey: string) => {
    if (
      (verifiers[key].required || input.hasOwnProperty(realKey)) &&
      !verifyElement(verifiers[key], input[realKey])
    ) {
      log("warn", "invalid state", {
        statePath,
        input,
        key: realKey,
        ver: verifiers[key],
      });
      emitDescription(verifiers[key].description(input));
      if (verifiers[key].deleteBroken !== undefined) {
        res =
          verifiers[key].deleteBroken === "parent"
            ? undefined
            : deleteOrNop(res, [realKey]);
      } else if (verifiers[key].repair !== undefined) {
        try {
          const fixed = verifiers[key].repair(
            input[realKey],
            defaults[realKey],
          );
          res = update(res, { [realKey]: { $set: fixed } });
        } catch (err) {
          if (err instanceof VerifierDrop) {
            res = deleteOrNop(res, [realKey]);
          } else if (err instanceof VerifierDropParent) {
            res = undefined;
          }
        }
      } else {
        res = update(res, { [realKey]: { $set: defaults[realKey] } });
      }
    } else if (verifiers[key].elements !== undefined) {
      recurse(key, realKey);
    }
  };

  Object.keys(verifiers).forEach((key) => {
    if (res === undefined) {
      return;
    }
    // _ is placeholder for every item
    if (key === "_") {
      Object.keys(res).forEach((mapKey) => doTest(key, mapKey));
    } else {
      doTest(key, key);
    }
  });
  return res;
}

export enum Decision {
  SANITIZE,
  IGNORE,
  QUIT,
}

let backupTime: number;

function hydrateRed(
  state: any,
  payload: any,
  ele: any,
  statePath: string,
  replace: boolean,
  querySanitize: (errors: string[]) => Decision,
) {
  const pathArray = statePath.split(".").slice(1);

  if (ele.verifiers !== undefined) {
    const input = getSafe(payload, pathArray, undefined);
    const errors: string[] = [];
    let moreCount = 0;
    const sanitized = verify(
      statePath,
      ele.verifiers,
      input,
      ele.defaults,
      (error: string) => {
        if (errors.length < 10) {
          errors.push(error);
        } else {
          ++moreCount;
        }
      },
    );
    if (sanitized !== input) {
      if (moreCount > 0) {
        errors.push(`... ${moreCount} more errors ...`);
      }
      const decision = querySanitize(errors);
      if (decision === Decision.SANITIZE) {
        const backupPath = path.join(app.getPath("temp"), STATE_BACKUP_PATH);
        log("info", "sanitizing application state");
        let backupData;
        if (backupTime !== undefined) {
          const oldBackup = fs.readFileSync(
            path.join(backupPath, `backup_${backupTime}.json`),
            { encoding: "utf-8" },
          );
          backupData = { ...JSON.parse(oldBackup), ...payload };
        } else {
          backupData = payload;
          backupTime = Date.now();
        }
        fs.ensureDirSync(backupPath);
        fs.writeFileSync(
          path.join(backupPath, `backup_${backupTime}.json`),
          JSON.stringify(backupData, undefined, 2),
        );
        payload = setSafe(payload, pathArray, sanitized);
      } else if (decision === Decision.QUIT) {
        app.exit();
        throw new UserCanceled();
      } // in case of ignore we just continue with the original payload
    }
  }
  return rehydrate(state, payload, pathArray, replace, ele.defaults);
}

function deriveReducer(
  statePath: string,
  ele: any,
  querySanitize: (errors: string[]) => Decision,
  onError: (error: Error) => void,
): Reducer<any> {
  const attributes: string[] = Object.keys(ele);

  if (
    attributes.indexOf("reducers") !== -1 &&
    attributes.indexOf("defaults") !== -1
  ) {
    let red = ele.reducers;
    if (red["__hydrate"] === undefined) {
      red = {
        ...ele.reducers,
        ["__hydrate"]: (state, payload) =>
          hydrateRed(state, payload, ele, statePath, false, querySanitize),
        ["__hydrate_replace"]: (state, payload) =>
          hydrateRed(state, payload, ele, statePath, true, querySanitize),
      };
    }
    return createReducer(red, ele.defaults);
  } else {
    const combinedReducers: ReducersMapObject = {};

    attributes.forEach((attribute) => {
      combinedReducers[attribute] = deriveReducer(
        statePath + "." + attribute,
        ele[attribute],
        querySanitize,
        onError,
      );
    });
    return safeCombineReducers(combinedReducers, onError);
  }
}

function addToTree(tree: any, statePath: string[], spec: IReducerSpec) {
  if (statePath.length === 0) {
    if (tree.reducers === undefined) {
      tree.reducers = {};
    }
    if (tree.defaults === undefined) {
      tree.defaults = {};
    }
    Object.assign(tree.reducers, spec.reducers);
    tree.defaults = deepMerge(tree.defaults, spec.defaults);
    if (spec.verifiers !== undefined) {
      tree.verifiers = deepMerge(tree.verifiers, spec.verifiers);
    }
  } else {
    if (!(statePath[0] in tree)) {
      tree[statePath[0]] = {};
    }
    addToTree(tree[statePath[0]], statePath.slice(1), spec);
  }
}

/**
 * initialize reducer tree
 *
 * @export
 * @param {IExtensionReducer[]} extensionReducers
 * @returns
 */
function reducers(
  extensionReducers: IExtensionReducer[],
  querySanitize: (errors: string[]) => Decision,
  onError: (err: Error) => void,
) {
  const tree = {
    user: userReducer,
    app: appReducer,
    persistent: {
      loadOrder: loReducer,
    },
    session: {
      base: sessionReducer,
      notifications: notificationsReducer,
    },
    settings: {
      window: windowReducer,
      tables: tableReducer,
      notifications: notificationSettingsReducer,
    },
  };

  extensionReducers.forEach((extensionReducer) => {
    addToTree(tree, extensionReducer.path, extensionReducer.reducer);
  });
  return enableBatching(deriveReducer("", tree, querySanitize, onError));
}

export default reducers;
