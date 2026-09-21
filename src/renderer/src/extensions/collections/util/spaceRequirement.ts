import * as path from "path";

import * as winapi from "winapi-bindings";

import type { IModRule } from "../../mod_management/types/IMod";
import { isDependencyRule } from "../../mod_management/util/testModReference";

/**
 * Headroom left free on top of what the collection itself needs. A volume driven
 * to literally zero bytes breaks far more than the install - matches the
 * allowance testPathTransfer already applies when moving the staging folder.
 */
export const SPACE_SAFETY_MARGIN = 512 * 1024 * 1024;

export interface IVolumeRequirement {
  /** Volume root, e.g. "D:\\" - what the user has to free space on. */
  volume: string;
  /** Bytes the install needs on this volume, safety margin included. */
  required: number;
  /** Bytes currently free, or undefined when the volume couldn't be queried. */
  free: number | undefined;
}

/**
 * What a member already has on disk. An archive that's downloaded but not yet
 * installed still needs room to unpack, so "downloaded" is not the same as
 * "costs nothing".
 */
export type MemberState = "missing" | "downloaded" | "installed";

export interface ISpaceRequirement {
  /** Archive bytes still to be fetched. */
  downloadBytes: number;
  /** Bytes the extracted mods are expected to occupy. */
  stagingBytes: number;
  /** One entry per distinct volume, already merged when paths share a drive. */
  volumes: IVolumeRequirement[];
  /** Volumes that can't fit the install. Empty means it's safe to start. */
  shortfalls: IVolumeRequirement[];
}

/**
 * How much the extracted mods take relative to their archives. Measured at ~1.4
 * installing Gopher's Stable New Vegas (290MB of archives, ~400MB staged), so
 * 1.5 covers that with a little room. It is an estimate either way - archives
 * are mostly pre-compressed assets, but the ratio varies a lot by collection,
 * so this is a guard against "nowhere near enough" rather than a prediction of
 * the exact footprint.
 */
const EXTRACTED_SIZE_RATIO = 1.5;

function volumeOf(dirPath: string): string {
  try {
    return winapi.GetVolumePathName(dirPath);
  } catch {
    // unmapped or not-yet-created path: fall back to the parsed root
    return path.parse(dirPath).root;
  }
}

function freeBytesOn(dirPath: string): number | undefined {
  try {
    return winapi.GetDiskFreeSpaceEx(dirPath).freeToCaller;
  } catch {
    // an unreachable drive is not a shortfall we can prove - say nothing
    return undefined;
  }
}

/**
 * What a collection still needs on disk, per volume.
 *
 * Sizes come from the collection's own rules, so this is answerable before a
 * single byte is fetched. `alreadyHave` lets the caller exclude archives that
 * are already downloaded, so resuming a partly-installed collection doesn't ask
 * for space it no longer needs.
 *
 * The download folder, the staging folder and the game can each be on different
 * drives; when two of them share one, their requirements are summed against
 * that drive's free space rather than checked separately.
 */
export function calculateSpaceRequirement(
  rules: IModRule[],
  paths: { downloadPath: string; stagingPath: string },
  memberState: (rule: IModRule) => MemberState = () => "missing",
): ISpaceRequirement {
  const members = (rules ?? [])
    .filter(isDependencyRule)
    .map((rule) => ({ size: rule.reference?.fileSize ?? 0, state: memberState(rule) }));

  // Only what isn't downloaded yet has to be fetched...
  const downloadBytes = members
    .filter((member) => member.state === "missing")
    .reduce((total, member) => total + member.size, 0);

  // ...but anything not yet installed still has to be unpacked, including
  // archives that are already sitting in the download folder.
  const stagingBytes = Math.round(
    members
      .filter((member) => member.state !== "installed")
      .reduce((total, member) => total + member.size, 0) * EXTRACTED_SIZE_RATIO,
  );

  const byVolume = new Map<string, number>();
  const add = (dirPath: string, bytes: number) => {
    const volume = volumeOf(dirPath);
    byVolume.set(volume, (byVolume.get(volume) ?? 0) + bytes);
  };
  add(paths.downloadPath, downloadBytes);
  add(paths.stagingPath, stagingBytes);

  const volumes: IVolumeRequirement[] = [...byVolume.entries()]
    .filter(([, bytes]) => bytes > 0)
    .map(([volume, bytes]) => ({
      volume,
      required: bytes + SPACE_SAFETY_MARGIN,
      free: freeBytesOn(volume),
    }));

  return {
    downloadBytes,
    stagingBytes,
    volumes,
    // `free === undefined` means the volume couldn't be queried; refusing to
    // install on a guess would be worse than letting it run and fail honestly.
    shortfalls: volumes.filter((vol) => vol.free !== undefined && vol.free < vol.required),
  };
}
