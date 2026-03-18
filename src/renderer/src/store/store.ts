import type * as Redux from "redux";

import _ from "lodash";
import * as path from "path";

import type { IState } from "../types/IState";

import { DataInvalid } from "../util/CustomErrors";
import * as fs from "../util/fs";
import { writeFileAtomic } from "../util/fsAtomic";
import getVortexPath from "../util/getVortexPath";
import { log } from "../util/log";
export { currentStatePath } from "@vortex/shared/state";

export const FULL_BACKUP_PATH = "state_backups_full";

export async function createFullStateBackup(
  backupName: string,
  store: Redux.Store<IState>,
): Promise<string> {
  const before = Date.now();
  // not backing up confidential, session or extension persistors
  const state = _.pick(store.getState(), [
    "settings",
    "persistent",
    "app",
    "user",
  ]);
  let serialized: string;
  try {
    serialized = JSON.stringify(state, undefined, 2);
  } catch (err) {
    log("error", "Failed to create state backup", err);
    throw new DataInvalid("Failed to create state backup");
  }

  const basePath = path.join(
    getVortexPath("userData"),
    "temp",
    FULL_BACKUP_PATH,
  );

  const backupFilePath = path.join(basePath, backupName + ".json");

  await fs.ensureDirWritableAsync(basePath, () => Promise.resolve());
  await writeFileAtomic(backupFilePath, serialized);

  log("info", "state backup created", {
    ms: Date.now() - before,
    size: serialized.length,
  });

  return backupFilePath;
}
