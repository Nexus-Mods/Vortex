import update from "immutability-helper";

import type { IStateVerifier } from "../types/IExtensionContext";
import { VerifierDrop, VerifierDropParent } from "../types/IExtensionContext";

function deleteKey(obj: any, key: string): any {
  if (obj === undefined || !Object.hasOwnProperty.call(obj, key)) {
    return obj;
  }
  return update(obj, { $unset: [key] });
}

export function verifyElement(verifier: IStateVerifier, value: any) {
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

export type LogFn = (level: string, message: string, metadata?: any) => void;

// keyed by state key, "_" for every key
type Verifiers = Record<string, IStateVerifier>;

/**
 * Applies only the repairs of silent verifiers, which need no consent, so they hold whatever the
 * user decides about the other problems in the same state.
 */
export function applySilentRepairs<T>(
  statePath: string,
  verifiers: Verifiers,
  input: T,
  defaults: Record<string, unknown> = {},
  log: LogFn = noop,
): T {
  return verify(statePath, verifiers, input, defaults, () => undefined, log, undefined, true) as T;
}

const noop: LogFn = () => {};

export function verify(
  statePath: string,
  verifiers: Verifiers | undefined,
  input: any,
  defaults: { [key: string]: any },
  emitDescription: (description: string) => void,
  log: LogFn = noop,
  // key under which `input` lives in its parent (e.g. a modId for a mod
  // record). Threaded through the recursion so a `repair` can recover a value
  // from the record's own identity - see the installationPath self-heal in
  // mod_management/reducers/mods.ts (GH#23363/#23355).
  containerKey?: string,
  // only fill in the missing values of silent verifiers, leaving every other finding alone
  silentOnly: boolean = false,
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
      log,
      mapKey,
      silentOnly,
    );
    if (sane !== res[mapKey]) {
      res = sane === undefined ? deleteKey(res, mapKey) : update(res, { [mapKey]: { $set: sane } });
    }
  };

  // a missing value under a silent verifier that deletes nothing; anything else is left alone
  const fillInSilently = (key: string, realKey: string) => {
    const verifier = verifiers[key];
    if (
      verifier.silent !== true ||
      verifier.deleteBroken !== undefined ||
      (input as Record<string, unknown>)[realKey] !== undefined
    ) {
      return;
    }
    let filled: unknown;
    try {
      filled =
        verifier.repair !== undefined
          ? verifier.repair(undefined, defaults[realKey], {
              parentKey: containerKey,
              parent: input,
              key: realKey,
            })
          : defaults[realKey];
    } catch {
      // a repair that drops the value is for the reported checks
      return;
    }
    if (filled !== undefined) {
      log("debug", "filled in missing state", { statePath, key: realKey });
      res = update(res as Record<string, unknown>, { [realKey]: { $set: filled } });
    }
  };

  const doTest = (key: string, realKey: string) => {
    if (
      (verifiers[key].required || input.hasOwnProperty(realKey)) &&
      !verifyElement(verifiers[key], input[realKey])
    ) {
      if (silentOnly) {
        fillInSilently(key, realKey);
        return;
      }
      log("warn", "invalid state", {
        statePath,
        input,
        key: realKey,
        ver: verifiers[key],
      });
      emitDescription(verifiers[key].description(input));
      if (verifiers[key].deleteBroken !== undefined) {
        res = verifiers[key].deleteBroken === "parent" ? undefined : deleteKey(res, realKey);
      } else if (verifiers[key].repair !== undefined) {
        try {
          const fixed = verifiers[key].repair(input[realKey], defaults[realKey], {
            parentKey: containerKey,
            parent: input,
            key: realKey,
          });
          res = update(res, { [realKey]: { $set: fixed } });
        } catch (err) {
          if (err instanceof VerifierDrop) {
            res = deleteKey(res, realKey);
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
