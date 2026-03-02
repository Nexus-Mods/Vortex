import type * as pathT from "path";
import { unknownToError } from "@vortex/shared";

/**
 * Monkey patching is obviously considered evil but there may be cases where the alternative
 * would be for us to require all extension developers to follow certain rules and so
 * applying this crowbar-approach may actually be safer.
 */

function monkeyPatch(
  clazz: any,
  functionName: string,
  wrapper: (orig, ...args: any[]) => any,
) {
  const orig = clazz.prototype[functionName];
  clazz.prototype[functionName] = function (...args: any[]) {
    return wrapper.apply(this, [orig, ...args]);
  };
}

function fallbackDateFormat(
  locales?: string | string[],
  options?: Intl.DateTimeFormatOptions,
) {
  // adapted from https://github.com/GoogleChrome/lighthouse/issues/1056
  let formatter;
  let tz;
  try {
    // the Intl.DateTimeFormat constructor will itself throw an exception if options contains
    // an invalid timezone. This is of course usage error but whatevs.
    formatter = new Intl.DateTimeFormat(locales, options);
    tz = formatter.resolvedOptions().timeZone;
  } catch (err) {
    // nop
  }

  // Force UTC if runtime timezone could not be detected.
  if (!tz || tz.toLowerCase() === "etc/unknown") {
    options = { ...options, timeZone: "UTC" };
    formatter = new Intl.DateTimeFormat(locales, options);
  }
  return formatter.format(this);
}

function applyMonkeyPatches() {
  monkeyPatch(
    Date,
    "toLocaleString",
    function (
      orig,
      locales?: string | string[],
      options?: Intl.DateTimeFormatOptions,
    ) {
      try {
        return orig.apply(this, [locales, options]);
      } catch (err) {
        if (
          err instanceof RangeError &&
          err.message.indexOf("Unsupported time zone specified") !== -1
        ) {
          return fallbackDateFormat.apply(this, [
            locales,
            {
              day: "numeric",
              month: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "numeric",
              second: "numeric",
              timeZoneName: "short",
              ...options,
            },
          ]);
        } else {
          throw err;
        }
      }
    },
  );

  monkeyPatch(
    Date,
    "toLocaleDateString",
    function (
      orig,
      locales?: string | string[],
      options?: Intl.DateTimeFormatOptions,
    ) {
      try {
        return orig.apply(this, [locales, options]);
      } catch (err) {
        if (
          err instanceof RangeError &&
          err.message.indexOf("Unsupported time zone specified") !== -1
        ) {
          return fallbackDateFormat.apply(this, [
            locales,
            {
              day: "numeric",
              month: "numeric",
              year: "numeric",
              ...options,
            },
          ]);
        } else {
          throw err;
        }
      }
    },
  );

  monkeyPatch(
    Date,
    "toLocaleTimeString",
    function (
      orig,
      locales?: string | string[],
      options?: Intl.DateTimeFormatOptions,
    ) {
      try {
        return orig.apply(this, [locales, options]);
      } catch (err) {
        if (
          err instanceof RangeError &&
          err.message.indexOf("Unsupported time zone specified") !== -1
        ) {
          return fallbackDateFormat.apply(this, [
            locales,
            {
              hour: "numeric",
              minute: "numeric",
              second: "numeric",
              timeZoneName: "short",
              ...options,
            },
          ]);
        } else {
          throw err;
        }
      }
    },
  );

  const path: typeof pathT = require("path");
  const oldJoin = path.join;
  const oldResolve = path.resolve;
  // tslint:disable-next-line:only-arrow-functions
  path.join = function (...paths: string[]) {
    try {
      return oldJoin(...paths);
    } catch (unknownError) {
      const err = unknownToError(unknownError);
      err["paths"] = paths;
      throw err;
    }
  };

  path.resolve = function (...paths: string[]) {
    try {
      return oldResolve(...paths);
    } catch (unknownError) {
      const err = unknownToError(unknownError);
      err["paths"] = paths;
      throw err;
    }
  };
}

applyMonkeyPatches();
