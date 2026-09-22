import * as path from "path";

import _ from "lodash";
import type * as Redux from "redux";

import type { IState } from "../types/IState";
import { DataInvalid } from "../util/CustomErrors";
import * as fs from "../util/fs";
import { writeFileAtomic } from "../util/fsAtomic";
import getVortexPath from "../util/getVortexPath";
import { log } from "../util/log";
export { currentStatePath } from "@vortex/shared/state";

export const FULL_BACKUP_PATH = "state_backups_full";

/**
 * The hives a state backup contains. `confidential` (credentials), `session` and
 * extension persistors are deliberately left out.
 */
export const BACKUP_HIVES = [
  "settings",
  "persistent",
  "app",
  "user",
] as const satisfies readonly (keyof IState)[];

/**
 * Serialise the given hives of the store as pretty-printed JSON. Throws `DataInvalid` if
 * the state can't be stringified.
 */
export function serializeState(
  store: Redux.Store<IState>,
  hives: readonly (keyof IState)[],
): string {
  const state = _.pick(store.getState(), hives);
  try {
    return JSON.stringify(state, undefined, 2);
  } catch (err) {
    log("error", "Failed to serialize state", err);
    throw new DataInvalid("Failed to serialize state");
  }
}

export async function createFullStateBackup(
  backupName: string,
  store: Redux.Store<IState>,
): Promise<string> {
  const before = Date.now();
  const serialized = serializeState(store, BACKUP_HIVES);

  const basePath = path.join(getVortexPath("userData"), "temp", FULL_BACKUP_PATH);

  const backupFilePath = path.join(basePath, backupName + ".json");

  await fs.ensureDirWritableAsync(basePath, () => Promise.resolve());
  await writeFileAtomic(backupFilePath, serialized);

  log("info", "state backup created", {
    ms: Date.now() - before,
    size: serialized.length,
  });

  return backupFilePath;
}
