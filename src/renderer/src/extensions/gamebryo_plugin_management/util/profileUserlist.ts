import { copyFile, mkdir } from "node:fs/promises";
import * as path from "node:path";

import { getErrorCode } from "@vortex/shared";

import getVortexPath from "../../../util/getVortexPath";
import type { IProfile } from "../../profile_management/types/IProfile";
import { profilePath } from "../../profile_management/util/manage";
import { listPaths } from "./metadataLists";

/** Where a game's LOOT userlist, its global backup and its per-profile copies live. */
export function userlistPaths(gameId: string) {
  const active = listPaths(getVortexPath("userData"), gameId).userlist;
  return {
    active,
    globalBackup: `${active}.global`,
    profileFile: (profile: IProfile) => path.join(profilePath(profile), "userlist.yaml"),
  };
}

/** Copies a file; a missing source is nothing to copy. */
export async function copyIgnoringMissing(src: string, dest: string): Promise<void> {
  try {
    await copyFile(src, dest);
  } catch (err) {
    if (getErrorCode(err) !== "ENOENT") {
      throw err;
    }
  }
}

/**
 * Swaps the active userlist.yaml between profiles that keep their own LOOT rules
 * (the local_loot_rules profile feature). Called after the persistors are disabled so no stale
 * write lands on the swapped file. Leaving a local-rules profile saves its rules to its profile
 * folder; entering one restores its saved rules, or seeds them from the active file the first
 * time; the global rules are backed up on the way in and restored on the way out.
 */
export async function swapUserlistForProfile(
  oldProfile: IProfile | undefined,
  newProfile: IProfile | undefined,
): Promise<void> {
  const oldHasLocal = oldProfile?.features?.local_loot_rules === true;
  const newHasLocal = newProfile?.features?.local_loot_rules === true;

  if (!oldHasLocal && !newHasLocal) {
    return;
  }

  const gameId = oldProfile?.gameId ?? newProfile?.gameId;
  if (gameId === undefined) {
    return;
  }

  const paths = userlistPaths(gameId);

  // save old profile's rules to its profile directory
  if (oldHasLocal && oldProfile?.pendingRemove !== true) {
    await mkdir(profilePath(oldProfile), { recursive: true });
    await copyIgnoringMissing(paths.active, paths.profileFile(oldProfile));

    if (!newHasLocal) {
      // restore global backup
      await copyIgnoringMissing(paths.globalBackup, paths.active);
    }
  }

  // load new profile's rules from its profile directory
  if (newHasLocal) {
    if (!oldHasLocal) {
      // back up the current global userlist
      await copyIgnoringMissing(paths.active, paths.globalBackup);
    }

    try {
      // the profile has a saved copy: restore it
      await copyFile(paths.profileFile(newProfile), paths.active);
    } catch (err) {
      if (getErrorCode(err) === "ENOENT") {
        // first time: seed the profile dir from the current file
        await mkdir(profilePath(newProfile), { recursive: true });
        await copyIgnoringMissing(paths.active, paths.profileFile(newProfile));
      } else {
        throw err;
      }
    }
  }
}
