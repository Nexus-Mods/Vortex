/**
 * Provides SMAPI-compatible semantic version normalization and comparison.
 */
import * as semver from 'semver';

/**
 * semver.coerce drops pre-release information from a
 * perfectly valid semantic version string, don't want that
 */
export function coerce(input: string): semver.SemVer {
  try {
    return new semver.SemVer(input);
  } catch (_err) {
    return semver.coerce(input) ?? new semver.SemVer('0.0.0');
  }
}

/** Compares two semantic versions using SMAPI-compatible coercion rules. */
export function semverCompare(lhs: string, rhs: string): number {
  const l = coerce(lhs);
  const r = coerce(rhs);
  if ((l !== null) && (r !== null)) {
    return semver.compare(l, r);
  } else {
    return lhs.localeCompare(rhs, 'en-US');
  }
}
