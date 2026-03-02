import PromiseBB from "bluebird";
// we don't want errors from this function to be reported to the user, there is
// sensible fallbacks for if fs calls fail
import * as fsOrig from "fs-extra";
import * as path from "path";
import { restackErr } from "./util";
import { getErrorCode, getErrorMessageOrDefault } from "@vortex/shared";

export type Normalize = (input: string) => string;

function genNormalizeSeparator(
  func: (input: string) => string,
): (input: string) => string {
  const sepRE = /\//g;
  return (input: string) => func(input).replace(sepRE, path.sep);
}

function genNormalizeUnicode(
  func: (input: string) => string,
): (input: string) => string {
  return (input: string) => func(input).normalize();
}

function genNormalizeRelative(
  func: (input: string) => string,
): (input: string) => string {
  return (input: string) => path.normalize(func(input)).replace(/[\\/]$/, "");
}

function genNormalizeCase(): (input: string) => string {
  return (input: string) => input.toUpperCase();
}

export interface INormalizeParameters {
  // normalize path separators (only on windows, transforms forward slashes to backslashes)
  separators?: boolean;
  // normalize unicode symbols that can have multiple equivalent representations
  unicode?: boolean;
  // reduce "..", remove ".", remove redundant slashes
  relative?: boolean;
}

function isCaseSensitiveFailed(
  testPath: string,
  reason: string,
): PromiseBB<boolean> {
  if (testPath === undefined) {
    return PromiseBB.resolve(process.platform !== "win32");
  }
  const parentPath = path.dirname(testPath);
  if (parentPath === testPath) {
    // on windows, assume case insensitive, everywhere else: case sensitive
    return PromiseBB.resolve(process.platform !== "win32");
  } else {
    return isCaseSensitive(parentPath);
  }
}

function isCaseSensitive(testPath: string): PromiseBB<boolean> {
  return PromiseBB.resolve(fsOrig.readdir(testPath))
    .then((files) => {
      // we need a filename that contains letters with case variants, otherwise we can't
      // determine case sensitivity
      const fileName = files.find(
        (file) => file !== file.toLowerCase() || file !== file.toUpperCase(),
      );

      if (fileName === undefined) {
        return null;
      }

      // to find out if case sensitive, stat the file itself and the upper and lower case variants.
      // if they are all the same file, it's case insensitive
      return PromiseBB.map(
        [fileName, fileName.toLowerCase(), fileName.toUpperCase()],
        (file) =>
          PromiseBB.resolve(fsOrig.stat(path.join(testPath, file))).reflect(),
      );
    })
    .then((stats: Array<PromiseBB.Inspection<fsOrig.Stats>>) => {
      if (stats === null) {
        return isCaseSensitiveFailed(testPath, "Not found");
      }

      if (
        stats[1].isFulfilled() &&
        stats[2].isFulfilled() &&
        stats[0].value().ino === stats[1].value().ino &&
        stats[0].value().ino === stats[2].value().ino
      ) {
        return false;
      } else {
        return true;
      }
    })
    .catch((err) => {
      return isCaseSensitiveFailed(testPath, getErrorMessageOrDefault(err));
    });
}

/**
 * determine a function to normalize file names for the
 * file system in the specified path.
 * The second parameter can be used to specify how strict the normalization is.
 * Ideally you want everything but that makes the function slower and this function may
 * be called a lot. Oftentimes the source of the input path already guarantees some
 * normalization anyway.
 *
 * @param {string} path
 * @returns {PromiseBB<Normalize>}
 */
function getNormalizeFunc(
  testPath: string,
  parameters?: INormalizeParameters,
): PromiseBB<Normalize> {
  if (parameters === undefined) {
    parameters = {};
  }

  const stackErr = new Error();

  return isCaseSensitive(testPath)
    .then((caseSensitive) => {
      let funcOut = caseSensitive
        ? (input: string) => input
        : genNormalizeCase();

      if (parameters["separators"] !== false && process.platform === "win32") {
        funcOut = genNormalizeSeparator(funcOut);
      }
      if (parameters["unicode"] !== false) {
        funcOut = genNormalizeUnicode(funcOut);
      }
      if (parameters["relative"] !== false) {
        funcOut = genNormalizeRelative(funcOut);
      }
      return funcOut;
    })
    .catch((err) => {
      const code = getErrorCode(err);
      if (code === "ENOENT") {
        const parent = path.dirname(testPath);
        return parent === testPath
          ? PromiseBB.reject(restackErr(err, stackErr))
          : getNormalizeFunc(parent);
      } else {
        return PromiseBB.reject(restackErr(err, stackErr));
      }
    });
}

class NormalizationHandler<T extends object> {
  private keymap: { [key: string]: string };
  private normalize: Normalize;

  constructor(init: T, normalize: Normalize) {
    this.normalize = normalize;

    this.keymap = Object.keys(init).reduce((prev, origKey) => {
      prev[normalize(origKey)] = origKey;
      return prev;
    }, {});
  }

  public get(target: T, key: PropertyKey) {
    let res;
    if (typeof key === "string") {
      const remapKey = this.keymap[this.normalize(key)];
      res = target[remapKey];
    } else {
      res = target[key];
    }

    if (res instanceof Object && !Array.isArray(res) && !(res instanceof Set)) {
      return new Proxy(res, new NormalizationHandler(res, this.normalize));
    } else {
      return res;
    }
  }

  public deleteProperty(target: T, key: PropertyKey) {
    if (typeof key === "string") {
      const remapKey = this.keymap[this.normalize(key)];
      delete target[remapKey];
    } else {
      delete target[key];
    }
    return true;
  }
  public has(target: T, key: PropertyKey) {
    if (typeof key === "string") {
      const remapKey = this.keymap[this.normalize(key)];
      return remapKey in target;
    } else {
      return (key as any) in target;
    }
  }
  public set(target: T, key: PropertyKey, value: any) {
    if (typeof key === "string") {
      this.keymap[this.normalize(key)] = key;
    }
    target[key] = value;
    return true;
  }
}

/**
 * creates a proxy for a dictionary that makes all key access normalized with the specified
 * normalization function
 */
export function makeNormalizingDict<T extends object>(
  input: T,
  normalize: Normalize,
): T {
  return new Proxy(input, new NormalizationHandler(input, normalize));
}

export default getNormalizeFunc;
