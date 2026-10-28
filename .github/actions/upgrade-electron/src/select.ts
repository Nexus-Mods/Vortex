import { type ElectronRelease, type NpmPackument } from "./schemas";
import { compare, isStable, major } from "./versions";

/** Whether something published at `published` (any `Date.parse` input) is at least `minAgeMs` old at `now`. */
const oldEnough = (published: string | undefined, minAgeMs: number, now: number): boolean =>
  published !== undefined && now - Date.parse(published) >= minAgeMs;

/**
 * The newest stable Electron release that is newer than `current`, shares its
 * major and is at least `minAgeMs` old (mirrors pnpm's minimumReleaseAge).
 */
export const newestRelease = (
  releases: readonly ElectronRelease[],
  current: string,
  minAgeMs: number,
  now: number,
): ElectronRelease | undefined =>
  releases
    .filter(
      (release) =>
        isStable(release.version) &&
        major(release.version) === major(current) &&
        compare(release.version, current) > 0 &&
        oldEnough(release.fullDate ?? release.date, minAgeMs, now),
    )
    .toSorted((a, b) => compare(a.version, b.version))
    .at(-1);

/** The newest stable node-abi that is newer than `current` and at least `minAgeMs` old. */
export const newestNodeAbi = (
  packument: NpmPackument,
  current: string,
  minAgeMs: number,
  now: number,
): string | undefined =>
  Object.keys(packument.versions)
    .filter(
      (version) =>
        isStable(version) &&
        compare(version, current) > 0 &&
        oldEnough(packument.time[version], minAgeMs, now),
    )
    .toSorted(compare)
    .at(-1);
