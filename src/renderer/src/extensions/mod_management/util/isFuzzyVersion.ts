import * as semver from "semver";

import { safeCoerce } from "./coerceToSemver";

const fuzzyVersionCache: { [input: string]: boolean } = {};

export function isFuzzyVersion(input: string) {
  const cachedRes: boolean = fuzzyVersionCache[input];
  if (cachedRes !== undefined) {
    return cachedRes;
  }

  if (!input || typeof input !== "string") {
    fuzzyVersionCache[input] = false;
  } else if (input.endsWith("+prefer") || input === "*") {
    // +prefer can be used with non-semver versions as well
    fuzzyVersionCache[input] = true;
  } else {
    // semver.validRange accepts partial versions as ranges, e.g. "1.5" is equivalent
    // to "1.5.x" but we can't accept that because then we can't distinguish them from
    // non-semantic versions where 1.5 should match exactly 1.5
    const coerced = safeCoerce(input);

    const valRange = semver.validRange(coerced);

    fuzzyVersionCache[input] = valRange !== null && valRange !== coerced;
  }

  return fuzzyVersionCache[input];
}
