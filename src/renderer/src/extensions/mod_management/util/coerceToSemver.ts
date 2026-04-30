import * as semver from "semver";

const coerceableRE = /^v?[0-9.]+$/;

export function coerceToSemver(version: string): string {
  version = version?.trim?.();
  if (!version) {
    return undefined;
  }
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (match) {
    const major = match[1];
    const minor = match[2];
    const patch = match[3];
    let preRelease = match[4].trim();

    // If there's something after the first three segments, treat it as pre-release
    if (preRelease) {
      // Remove leading punctuation from the pre-release part
      preRelease = preRelease.replace(/^[\.\-\+]/, "");
      return `${major}.${minor}.${patch}-${preRelease}`;
    } else {
      return `${major}.${minor}.${patch}`;
    }
  } else {
    if (coerceableRE.test(version)) {
      // Remove leading 0's from the version segments as that's
      //  an illegal semantic versioning format/pattern
      const sanitizedVersion = version.replace(/\b0+(\d)/g, "$1");
      const coerced = semver.coerce(sanitizedVersion);
      if (coerced) {
        return coerced.version;
      }
      return version;
    }
  }
}

export function safeCoerce(input: string): string {
  return coerceableRE.test(input) ? (coerceToSemver(input) ?? input) : input;
}
