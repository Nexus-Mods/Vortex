import { compare, major as semverMajor, prerelease, valid } from "semver";

export { compare };

/** Whether `version` is a valid semver version without a pre-release suffix. */
export const isStable = (version: string): boolean =>
  valid(version) !== null && prerelease(version) === null;

/** The major component of a valid version. */
export const major = (version: string): number => semverMajor(version);
