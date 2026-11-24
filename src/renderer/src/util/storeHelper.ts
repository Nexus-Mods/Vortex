/**
 * Helper functions when working with immutable state (or immutable objects in general)
 */

import PromiseBB from "bluebird";
import type * as Redux from "redux";

import type { IGameStored } from "../extensions/gamemode_management/types/IGameStored";
import type { IProfile } from "../types/api";

function clone<T>(input: T): T {
  return Array.isArray(input) ? ([...input] as T) : { ...(input as any) };
}

/**
 * return an item from state or the fallback if the path doesn't lead
 * to an item or if the item is null/undefined.
 *
 * @public
 * @deprecated Use optional chaining (`?.`) and nullish coalescing (`??`) instead.
 *
 * @example
 * ```ts
 * // before
 * getSafe(state, ["mods", modId, "attributes"], {});
 * // after
 * state.mods?.[modId]?.attributes ?? {};
 * ```
 * Use `??`, not `||`: getSafe returns the fallback only for `null` and `undefined`,
 * so a stored `0`, `""` or `false` comes back as is.
 */
export function getSafe<T>(state: any, path: Array<string | number | undefined>, fallback: T): T {
  if (!path || path.length === 0) {
    return state ?? fallback;
  }
  let current = state;
  for (let i = 0; i < path.length; i++) {
    current = current?.[path[i]!];
    if (current == null) {
      return fallback;
    }
  }
  return current ?? fallback;
}

/**
 * case insensitive variant of getSafe
 *
 * @public
 * @deprecated Use `Object.keys()` + `find()` for case-insensitive key lookup with optional chaining.
 */
export function getSafeCI<T>(state: any, path: Array<string | number>, fallback: T): T {
  let current = state;
  const getCaseCorrected = (obj: any, prop: string | number) => {
    if (typeof prop === "number") {
      return obj[prop] !== undefined ? prop : undefined;
    }
    const keys = Object.keys(obj);
    const idx = keys.map((key) => key.toLowerCase()).indexOf(prop.toLowerCase());
    if (idx === -1) {
      return undefined;
    }
    return keys[idx];
  };

  for (const segment of path) {
    if (current === undefined || current === null) {
      return fallback;
    }

    const caseCorrected = getCaseCorrected(current, segment);
    if (caseCorrected === undefined) {
      return fallback;
    }
    current = current[caseCorrected];
  }
  return current;
}

/**
 * @public
 * @deprecated Use direct assignment instead.
 */
export function mutateSafe<T>(state: T, path: Array<string | number>, value: any) {
  const firstElement = path[0];
  if (path.length === 1) {
    state[firstElement] = value;
  } else {
    if (!Object.hasOwnProperty.call(state, firstElement)) {
      state[firstElement] = {};
    }
    mutateSafe(state[firstElement], path.slice(1), value);
  }
}

/**
 * set an item in state, creating all intermediate nodes as necessary
 *
 * @public
 * @deprecated Use spread syntax with computed property names and nested spreads for immutable updates.
 *
 * @example
 * ```ts
 * // before
 * setSafe(state, ["mods", modId, "state"], "installed");
 * // after
 * ({
 *   ...state,
 *   mods: {
 *     ...state.mods,
 *     [modId]: { ...state.mods?.[modId], state: "installed" },
 *   },
 * });
 * ```
 * setSafe creates any missing intermediate object, so read each level with `?.` and
 * spread it: `{ ...undefined }` is `{}`.
 *
 * setSafe copies a level that is already an array with `slice()`, so it stays an array.
 * A spread would turn it into an object with index keys; replace the element instead:
 * ```ts
 * // before
 * setSafe(state, ["order", index], modId);
 * // after
 * ({ ...state, order: state.order.with(index, modId) });
 * ```
 * A level that doesn't exist yet is always created as `{}`, even when the next segment
 * is a number.
 */
export function setSafe<T extends object>(state: T, path: Array<string | number>, value: any): T {
  if (path.length === 0) {
    return { ...value };
  }
  const firstElement = path[0];
  const copy = Array.isArray(state) ? state.slice() : { ...(state as any) }; // "as any" is a workaround for
  // https://github.com/Microsoft/TypeScript/issues/13557

  if (path.length === 1) {
    copy[firstElement] = value;
  } else {
    if (!Object.hasOwnProperty.call(copy, firstElement)) {
      copy[firstElement] = {};
    }
    copy[firstElement] = setSafe(copy[firstElement], path.slice(1), value);
  }
  return copy;
}

/**
 * sets a value or do nothing if the path (except for the last element) doesn't exist.
 * That is: setOrNop does not create the object hierarchy referenced in the path but
 * it does add a new attribute to the object if necessary.
 *
 * @public
 * @deprecated Use computed property spread with optional chaining guard (e.g. `state.a?.b ? { ...state, a: { ...state.a, b: val } } : state`).
 *
 * @example
 * ```ts
 * // before
 * setOrNop(state, ["mods", modId, "state"], "installed");
 * // after
 * const mod = state.mods?.[modId];
 * mod === undefined
 *   ? state
 *   : { ...state, mods: { ...state.mods, [modId]: { ...mod, state: "installed" } } };
 * ```
 * Every segment but the last must already exist; if one is missing, setOrNop returns the
 * same `state` reference, so the replacement must return `state` too, not a copy. The last
 * key is added if it is missing. Check with `=== undefined`, not truthiness: an existing
 * `0`, `""` or `false` counts as present.
 */
export function setOrNop<T>(state: T, path: string[], value: any): T {
  const firstElement: string = path[0];
  let result = state;
  if (path.length === 1) {
    result = { ...(state as any) };
    result[firstElement] = value;
  } else {
    if (Object.hasOwnProperty.call(state, firstElement)) {
      const temp = setOrNop(result[firstElement], path.slice(1), value);
      if (temp !== result[firstElement]) {
        result = clone(result);
        result[firstElement] = temp;
      }
    }
  }
  return result;
}

/**
 * sets a value or do nothing if the path or the key (last element of the path) doesn't exist.
 * This means changeOrNop only changes a pre-existing object attribute
 *
 * @public
 * @deprecated Use `Object.hasOwn()` guard with spread, or `Object.assign()`.
 *
 * @example
 * ```ts
 * // before
 * changeOrNop(state, ["mods", modId, "state"], "installed");
 * // after
 * const mod = state.mods?.[modId];
 * mod === undefined || !Object.hasOwn(mod, "state")
 *   ? state
 *   : { ...state, mods: { ...state.mods, [modId]: { ...mod, state: "installed" } } };
 * ```
 * Unlike setOrNop, the last key must exist too. If anything on the path is missing,
 * changeOrNop returns the same `state` reference. Use `Object.hasOwn` for the last key:
 * a key that is present but `undefined` still counts, and changeOrNop overwrites it.
 */
export function changeOrNop<T>(state: T, path: Array<string | number>, value: any): T {
  const firstElement: string | number = path[0];
  let result = state;
  if (path.length === 1) {
    if (Object.hasOwnProperty.call(state, firstElement)) {
      result = { ...(state as any) };
      result[firstElement] = value;
    }
  } else {
    if (Object.hasOwnProperty.call(state, firstElement)) {
      const temp = changeOrNop(result[firstElement], path.slice(1), value);
      if (temp !== result[firstElement]) {
        result = clone(result);
        result[firstElement] = temp;
      }
    }
  }
  return result;
}

/**
 * delete a value or do nothing if the path doesn't exist
 *
 * @public
 * @deprecated Use destructuring rest (`{ [key]: _, ...rest }`) for objects, `Array.filter()` or `Array.toSpliced()` for arrays.
 *
 * @example
 * ```ts
 * // before
 * deleteOrNop(state, ["mods", modId, "attributes"]);
 * // after
 * const mod = state.mods?.[modId];
 * if (mod === undefined || !Object.hasOwn(mod, "attributes")) {
 *   return state;
 * }
 * const { attributes: _, ...rest } = mod;
 * return { ...state, mods: { ...state.mods, [modId]: rest } };
 * ```
 * If any key on the path is missing, deleteOrNop returns the same `state` reference.
 *
 * When the last level is an array, the last segment is an index and deleteOrNop splices
 * it out. Destructuring an array gives an object, so use `toSpliced` instead:
 * ```ts
 * // before
 * deleteOrNop(state, ["order", index]);
 * // after
 * ({ ...state, order: state.order.toSpliced(index, 1) });
 * ```
 */
export function deleteOrNop<T>(state: T, path: Array<string | number>): T {
  const firstElement = path[0];
  let result: any = state;
  if (path.length === 1) {
    if (Array.isArray(state)) {
      result = [...state];
      result.splice(firstElement as number, 1);
    } else if (Object.hasOwnProperty.call(state, firstElement)) {
      result = { ...(state as any) };
      delete result[firstElement];
    }
  } else {
    if (Object.hasOwnProperty.call(result, firstElement)) {
      const temp = deleteOrNop(result[firstElement], path.slice(1));
      if (temp !== result[firstElement]) {
        result = clone(result);
        result[firstElement] = temp;
      }
    }
  }

  return result;
}

/**
 * @public
 * @deprecated Use spread + nullish coalescing (`state.path ?? fallback`) with direct immutable updates.
 */
export function setDefaultArray<T>(state: T, path: Array<string | number>, fallback: any[]): T {
  const firstElement = path[0];
  const copy = Array.isArray(state) ? state.slice() : { ...(state as any) };

  if (path.length === 0) {
    return copy !== undefined && Array.isArray(copy) ? (copy as T) : (fallback as T);
  } else if (path.length === 1) {
    copy[firstElement] =
      !Object.hasOwnProperty.call(copy, firstElement) || !Array.isArray(copy[firstElement])
        ? fallback
        : copy[firstElement].slice();
  } else {
    if (!Object.hasOwnProperty.call(copy, firstElement) || typeof copy[firstElement] !== "object") {
      copy[firstElement] = {};
    }
    copy[firstElement] = setDefaultArray(copy[firstElement], path.slice(1), fallback);
  }
  return copy;
}

/**
 * push an item to an array inside state. This creates all intermediate
 * nodes and the array itself as necessary
 * @param state immutable object to update
 * @param path path to the item to update
 * @param value the value to add.
 *
 * @public
 * @deprecated Use array spread (`[...arr, value]`) or `Array.toSpliced()`.
 *
 * @example
 * ```ts
 * // before
 * pushSafe(state, ["mods", modId, "rules"], rule);
 * // after
 * const mod = state.mods?.[modId];
 * ({
 *   ...state,
 *   mods: {
 *     ...state.mods,
 *     [modId]: { ...mod, rules: [...(mod?.rules ?? []), rule] },
 *   },
 * });
 * ```
 * Like setSafe, pushSafe creates missing intermediate objects and the array itself. It
 * also replaces a value that isn't an array with `[rule]`, where `?? []` would spread it
 * or throw; that only matters if the state can hold the wrong type.
 */
export function pushSafe<T>(state: T, path: Array<string | number>, value: any): T {
  const copy = setDefaultArray(state, path, Array<unknown>());
  getSafe(copy, path, Array<unknown>())?.push(value);
  return copy;
}

/**
 * add an item to an array inside state but don't allow duplicates
 * @param state immutable object to update
 * @param path path to the item to update
 * @param value the value to add.
 *
 * @public
 * @deprecated Use `arr.includes(value) ? state : [...arr, value]`.
 *
 * @example
 * ```ts
 * // before
 * addUniqueSafe(state, ["mods", modId, "rules"], rule);
 * // after
 * const mod = state.mods?.[modId];
 * const rules = mod?.rules ?? [];
 * rules.includes(rule)
 *   ? state
 *   : { ...state, mods: { ...state.mods, [modId]: { ...mod, rules: [...rules, rule] } } };
 * ```
 * When the value is already there, addUniqueSafe returns the same `state` reference.
 * Values are compared with `===`, so two equal objects are still different values.
 * Missing levels are created as in pushSafe.
 */
export function addUniqueSafe<T>(state: T, path: Array<string | number>, value: any): T {
  const copy = setDefaultArray(state, path, Array<unknown>());
  const arr = getSafe(copy, path, Array<unknown>());
  if (arr.indexOf(value) !== -1) {
    return state;
  }
  arr.push(value);
  return copy;
}

/**
 * remove a value from an array by value
 *
 * @public
 * @deprecated Use `arr.filter(v => v !== value)` or `arr.toSpliced(arr.indexOf(value), 1)`.
 *
 * @example
 * ```ts
 * // before
 * removeValue(state, ["mods", modId, "rules"], rule);
 * // after
 * const mod = state.mods?.[modId];
 * const rules = mod?.rules ?? [];
 * const index = rules.indexOf(rule);
 * index === -1
 *   ? state
 *   : {
 *       ...state,
 *       mods: { ...state.mods, [modId]: { ...mod, rules: rules.toSpliced(index, 1) } },
 *     };
 * ```
 * removeValue removes only the first match, and returns the same `state` reference when
 * there is none. `filter` removes every match and always returns a new array, so use it
 * only when the array can't hold duplicates and you check for a match first.
 */
export function removeValue<T>(state: T, path: Array<string | number>, value: any): T {
  const copy = setDefaultArray(state, path, Array<unknown>());
  const list = getSafe(copy, path, Array<unknown>());
  const idx = list.indexOf(value);
  if (idx === -1) {
    return state;
  }
  list.splice(idx, 1);
  return copy;
}

/**
 * remove all vales for which the predicate applies
 *
 * @public
 * @deprecated Use `arr.filter(ele => !predicate(ele))`.
 */
export function removeValueIf<T extends object>(
  state: T,
  path: Array<string | number>,
  predicate: (element: any) => boolean,
): T {
  return setSafe(
    state,
    path,
    getSafe(state, path, []).filter((ele) => !predicate(ele)),
  );
}

/**
 * shallow merge a value into the store at the specified location
 *
 * @public
 * @deprecated Use spread syntax (`{ ...obj, ...values }`).
 *
 * @example
 * ```ts
 * // before
 * merge(state, ["mods", modId, "attributes"], attributes);
 * // after
 * ({
 *   ...state,
 *   mods: {
 *     ...state.mods,
 *     [modId]: {
 *       ...state.mods?.[modId],
 *       attributes: { ...state.mods?.[modId]?.attributes, ...attributes },
 *     },
 *   },
 * });
 * ```
 * The merge is shallow: only the target object's own keys are combined. Missing levels
 * are created as in setSafe. With an empty path, `merge(state, [], values)` is
 * `{ ...state, ...values }`.
 */
export function merge<T extends object>(state: T, path: Array<string | number>, value: any): T {
  const newVal = { ...getSafe(state, path, {}), ...value };
  return setSafe(state, path, newVal);
}

/**
 * @public
 * @deprecated Use spread with nullish coalescing (`{ ...state, ...(inbound ?? {}) }`).
 */
export function rehydrate<T extends object>(
  state: T,
  inbound: any,
  path: string[],
  replace: boolean,
  defaults: any,
): T {
  const inState = getSafe(inbound, path, undefined);

  return inState !== undefined ? merge(replace ? defaults : state, [], inState) : state;
}

function waitUntil(predicate: () => boolean, interval: number = 100): PromiseBB<void> {
  return new PromiseBB<void>((resolve) => {
    setTimeout(() => {
      if (predicate()) {
        resolve();
      } else {
        waitUntil(predicate, interval);
      }
    }, interval);
  });
}

/**
 * return the stored static details about the currently selected game mode
 * or a fallback with the id '__placeholder'
 * the return value is a promise because known games are loaded during extension
 * initialization so there is quite a bit of code where we can't be sure
 * if this is yet available
 *
 * @public
 */
export function currentGame(store: Redux.Store<any>): PromiseBB<IGameStored> {
  const fallback: IGameStored = {
    id: "__placeholder",
    name: "<No game>",
    requiredFiles: [],
    executable: "",
  };

  // Helper function to get the active game ID without importing selectors
  // This inlines the logic from activeGameId selector to break circular dependency
  const getActiveGameId = (state: any): string | undefined => {
    const profileId = getSafe<string | undefined>(
      state,
      ["settings", "profiles", "activeProfileId"],
      undefined,
    );
    const profile = getSafe<IProfile | undefined>(
      state,
      ["persistent", "profiles", profileId],
      undefined,
    );
    return profile !== undefined ? profile.gameId : undefined;
  };

  let knownGames = getSafe<IGameStored[] | null>(
    store.getState(),
    ["session", "gameMode", "known"],
    null,
  );
  if (knownGames !== null && knownGames !== undefined) {
    const gameMode = getActiveGameId(store.getState());
    const res = knownGames.find((ele) => ele.id === gameMode);
    return PromiseBB.resolve(res || fallback);
  } else {
    return waitUntil(() => {
      knownGames = getSafe<IGameStored[] | null>(
        store.getState(),
        ["session", "gameMode", "known"],
        null,
      );
      return knownGames !== null && knownGames !== undefined;
    }).then(() => {
      const gameMode = getActiveGameId(store.getState());

      const res = knownGames?.find((ele) => ele.id === gameMode);
      return PromiseBB.resolve(res || fallback);
    });
  }
}
