import * as path from "path";

import { getErrorCode } from "@vortex/shared";
import PromiseBB from "bluebird";

import { UserCanceled } from "../../util/CustomErrors";
import * as fs from "../../util/fs";
import { copyFileAtomic } from "../../util/fsAtomic";
import { log } from "../../util/log";
import { resolveFileCase } from "../../util/resolvePathCase";

/**
 * Wine lets the game file's case differ from the profile's
 * copy, which must stay a single file rather than gain a twin.
 */
function profileCopyPath(profilePath: string, filePath: string): PromiseBB<string> {
  return PromiseBB.resolve(resolveFileCase(profilePath, path.basename(filePath)));
}

export function syncToProfile(
  profilePath: string,
  sourceFiles: string[],
  onError: (error: string, details: string | Error, allowReport?: boolean) => void,
): PromiseBB<void> {
  log("debug", "sync to profile", { profilePath, sourceFiles });
  return fs
    .ensureDirAsync(profilePath)
    .then(() =>
      PromiseBB.map(sourceFiles, (filePath: string) =>
        profileCopyPath(profilePath, filePath).then((destPath) =>
          copyFileAtomic(filePath, destPath)
            .catch(UserCanceled, () => {
              log("warn", "user canceled profile sync. That's not great...");
            })
            .catch((err) => {
              log("warn", "failed to copy to profile", { filePath, destPath });
              if (!["EBADF", "ENOENT"].includes(getErrorCode(err))) {
                // both indicate the file doesn't exist, which isn't a problem,
                // it's as if the file was empty
                onError("failed to sync to profile: " + filePath, err);
              }
            }),
        ),
      ),
    )
    .then(() => {
      log("debug", "sync to profile complete");
    })
    .catch((err) => PromiseBB.reject(new Error("failed to sync to profile: " + err.message)));
}

export function syncFromProfile(
  profilePath: string,
  sourceFiles: string[],
  onError: (error: string, details: string | Error, allowReport?: boolean) => void,
): PromiseBB<void> {
  log("debug", "sync from profile", { profilePath, sourceFiles });
  return PromiseBB.map(sourceFiles, (filePath: string) => {
    return profileCopyPath(profilePath, filePath)
      .then((srcPath) => copyFileAtomic(srcPath, filePath))
      .catch(UserCanceled, () => {
        log("warn", "user canceled profile sync. That's not great...");
      })
      .catch((err) => {
        if (err.code === "EPERM") {
          onError("failed to sync from profile", `${filePath} is write protected`, false);
        } else if (err.code !== "ENOENT") {
          onError("failed to sync from profile", err);
        }
      });
  })
    .then(() => {
      log("debug", "sync from profile complete");
    })
    .catch((err) => PromiseBB.reject(new Error("failed from sync to profile: " + err.message)));
}
