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

const noop: LogFn = () => {};

export function verify(
  statePath: string,
  verifiers: { [key: string]: IStateVerifier } | undefined,
  input: any,
  defaults: { [key: string]: any },
  emitDescription: (description: string) => void,
  log: LogFn = noop,
): any {
  if (input === undefined || verifiers === undefined) {
    return input;
  }
  let res = input;

  const recurse = (key: string, mapKey: string) => {
    const sane = verify(statePath, verifiers[key].elements, res[mapKey], {}, emitDescription, log);
    if (sane !== res[mapKey]) {
      res = sane === undefined ? deleteKey(res, mapKey) : update(res, { [mapKey]: { $set: sane } });
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
        res = verifiers[key].deleteBroken === "parent" ? undefined : deleteKey(res, realKey);
      } else if (verifiers[key].repair !== undefined) {
        try {
          const fixed = verifiers[key].repair(input[realKey], defaults[realKey]);
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
