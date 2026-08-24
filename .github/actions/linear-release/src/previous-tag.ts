import { compare, valid } from "semver";

const STABLE = /^v\d+\.\d+\.\d+$/u;
const PRERELEASE = /^v\d+\.\d+\.\d+-/u;

/**
 * The release that precedes `tag` on its own channel: pre-releases compare
 * against the previous pre-release, stables against the previous stable.
 * Returns the empty string when `tag` is the first release on its channel.
 *
 * The result is meant as one end of a merge-base: the previous tag usually
 * sits on a diverged release/vX.Y branch, and the fork point of the two tags
 * bounds exactly the commits new to this release.
 */
export const previousReleaseTag = (
  tags: readonly string[],
  tag: string,
  prerelease: boolean,
): string => {
  if (valid(tag) === null) {
    throw new Error(`"${tag}" is not a valid version tag`);
  }
  const channel = prerelease ? PRERELEASE : STABLE;
  const candidates = tags.filter(
    (candidate) =>
      channel.test(candidate) &&
      candidate !== tag &&
      valid(candidate) !== null &&
      compare(candidate, tag) < 0,
  );
  return candidates.toSorted(compare).at(-1) ?? "";
};
