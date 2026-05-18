/**
 * top level reducer. This combines all reducers into one
 */

import * as path from "path";

import { unknownToError } from "@vortex/shared";
import { pick } from "lodash";
import type { Reducer, ReducersMapObject } from "redux";
import { combineReducers } from "redux";
import { createReducer } from "redux-act";
import { enableBatching } from "redux-batched-actions";

import { log } from "../logging";
import type { IExtensionReducer } from "../types/extensions";
import type { IReducerSpec, IStateVerifier } from "../types/IExtensionContext";
import type { IState } from "../types/IState";
import { UserCanceled } from "../util/CustomErrors";
import { verify } from "./verify";
export { verify, verifyElement } from "./verify";
import deepMerge from "../util/deepMerge";
import * as fs from "../util/fs";
import getVortexPath from "../util/getVortexPath";
import { deleteOrNop, getSafe, rehydrate, setSafe } from "../util/storeHelper";
import { appReducer } from "./app";
import { downloadsReducer } from "./downloads";
import { loReducer } from "./loadOrder";
import { notificationsReducer } from "./notifications";
import { notificationSettingsReducer } from "./notificationSettings";
import { sessionReducer } from "./session";
import { tableReducer } from "./tables";
import { userReducer } from "./user";
import { windowReducer } from "./window";

export const STATE_BACKUP_PATH = "state_backups";

/**
 * wrapper for combineReducers that doesn't drop unexpected keys
 */
function safeCombineReducers(reducer: ReducersMapObject, onError: (error: Error) => void) {
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

export enum Decision {
  SANITIZE,
  IGNORE,
  QUIT,
}

let backupTime: number;

/**
 * Apply a list of DiffOperations from a main-process push to a reducer's state slice.
 *
 * Each reducer only owns part of the state tree. `statePath` (e.g. ".settings.window")
 * tells us which slice this is. We:
 *   1. Verify the hive matches (first path segment after root dot).
 *   2. Compute the sub-path for this reducer (e.g. ["window"]).
 *   3. For each operation whose path starts with that sub-path, strip the prefix
 *      and apply it to the local state using setSafe / deleteOrNop.
 */
function pushRed(state: any, payload: any, statePath: string): any {
  if (!payload || typeof payload.hive !== "string" || !Array.isArray(payload.operations)) {
    return state;
  }

  const pathArray: string[] = statePath.split(".").slice(1);
  // The first segment is the hive name (e.g. "settings")
  if (pathArray[0] !== payload.hive) {
    return state;
  }

  // Everything after the hive name is this reducer's sub-path within the hive
  const subPath: string[] = pathArray.slice(1);

  let result = state;
  for (const op of payload.operations) {
    if (!Array.isArray(op.path)) {
      continue;
    }
    // Only handle operations that fall within this reducer's subtree
    if (subPath.length > 0) {
      if (op.path.length < subPath.length) {
        continue;
      }
      const matches = subPath.every((seg: string, i: number) => op.path[i] === seg);
      if (!matches) {
        continue;
      }
    }
    // Path relative to this reducer's root
    const relativePath: string[] = op.path.slice(subPath.length);
    if (op.type === "set") {
      result = setSafe(result, relativePath, op.value);
    } else if (op.type === "remove") {
      result = deleteOrNop(result, relativePath);
    }
  }
  return result;
}

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
      log,
    );
    if (sanitized !== input) {
      if (moreCount > 0) {
        errors.push(`... ${moreCount} more errors ...`);
      }
      const decision = querySanitize(errors);
      if (decision === Decision.SANITIZE) {
        const backupPath = path.join(getVortexPath("temp"), STATE_BACKUP_PATH);
        log("info", "sanitizing application state");
        let backupData;
        if (backupTime !== undefined) {
          const oldBackup = fs.readFileSync(path.join(backupPath, `backup_${backupTime}.json`), {
            encoding: "utf-8",
          });
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
        void window.api.app.exit(0);
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

  if (attributes.indexOf("reducers") !== -1 && attributes.indexOf("defaults") !== -1) {
    let red = ele.reducers;
    if (red["__hydrate"] === undefined) {
      red = {
        ...ele.reducers,
        ["__hydrate"]: (state, payload) =>
          hydrateRed(state, payload, ele, statePath, false, querySanitize),
        ["__hydrate_replace"]: (state, payload) =>
          hydrateRed(state, payload, ele, statePath, true, querySanitize),
        ["__persist_push"]: (state, payload) => pushRed(state, payload, statePath),
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
export function buildReducerTree(extensionReducers: IExtensionReducer[]): ReducerTree {
  const tree = {
    user: userReducer,
    app: appReducer,
    persistent: {
      loadOrder: loReducer,
      downloads: downloadsReducer,
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
  return tree;
}

type ReducerTree = IReducerSpec | { [key: string]: ReducerTree };

interface VerifierSpec {
  statePath: string;
  verifiers: { [key: string]: IStateVerifier };
  defaults: { [key: string]: any };
}

function collectVerifierSpecs(tree: ReducerTree, statePath: string = ""): VerifierSpec[] {
  const specs: VerifierSpec[] = [];

  if ("reducers" in tree && "defaults" in tree) {
    // leaf node (IReducerSpec)
    const spec = tree as IReducerSpec;
    if (spec.verifiers !== undefined) {
      specs.push({
        statePath,
        verifiers: spec.verifiers,
        defaults: spec.defaults,
      });
    }
  } else {
    // branch node
    const branch = tree as { [key: string]: ReducerTree };
    for (const attr of Object.keys(branch)) {
      specs.push(...collectVerifierSpecs(branch[attr], statePath + "." + attr));
    }
  }

  return specs;
}

/**
 * Pre-sanitize hydration state before dispatching __hydrate actions.
 * Runs verification on all reducer specs, and if corruption is found,
 * shows an async dialog to let the user decide how to proceed.
 *
 * @param tree - The reducer tree built by buildReducerTree
 * @param hydratedState - The raw hydration payload from persistence
 * @param queryDecision - Async callback to ask the user what to do
 * @returns The (possibly sanitized) hydration state
 */
export async function sanitizeHydrationState(
  tree: ReducerTree,
  hydratedState: Partial<IState>,
  queryDecision: (errors: string[]) => Promise<Decision>,
): Promise<Partial<IState>> {
  const specs = collectVerifierSpecs(tree);
  const allErrors: string[] = [];
  const sanitizedPaths: Array<{ pathArray: string[]; sanitized: unknown }> = [];

  for (const { statePath, verifiers, defaults } of specs) {
    const pathArray = statePath.split(".").slice(1);
    const input: unknown = getSafe(hydratedState, pathArray, undefined);
    const errors: string[] = [];
    let moreCount = 0;
    const sanitized: unknown = verify(
      statePath,
      verifiers,
      input,
      defaults,
      (error: string) => {
        if (errors.length < 10) {
          errors.push(error);
        } else {
          ++moreCount;
        }
      },
      log,
    );
    if (sanitized !== input) {
      if (moreCount > 0) {
        errors.push(`... ${moreCount} more errors ...`);
      }
      allErrors.push(...errors);
      sanitizedPaths.push({ pathArray, sanitized });
    }
  }

  if (allErrors.length === 0) {
    return hydratedState;
  }

  const decision = await queryDecision(allErrors);

  if (decision === Decision.SANITIZE) {
    const backupPath = path.join(getVortexPath("temp"), STATE_BACKUP_PATH);
    log("info", "sanitizing application state");
    const backupStamp = Date.now();
    fs.ensureDirSync(backupPath);
    fs.writeFileSync(
      path.join(backupPath, `backup_${backupStamp}.json`),
      JSON.stringify(hydratedState, undefined, 2),
    );

    let result = hydratedState;
    for (const { pathArray, sanitized } of sanitizedPaths) {
      result = setSafe(result, pathArray, sanitized);
    }
    return result;
  } else if (decision === Decision.QUIT) {
    void window.api.app.exit(0);
    throw new UserCanceled();
  }

  // Decision.IGNORE — return original state unchanged
  return hydratedState;
}

function reducers(extensionReducers: IExtensionReducer[], onError: (err: Error) => void) {
  const tree = buildReducerTree(extensionReducers);
  // querySanitize is no longer needed — sanitization is handled
  // asynchronously before hydration via sanitizeHydrationState()
  return enableBatching(deriveReducer("", tree, () => Decision.SANITIZE, onError));
}

export default reducers;
