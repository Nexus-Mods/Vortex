//
// Functions for changing game id on a download.
// Since we arrange downloads into directories based on the "primary" game,
// changing the game id may cause a file to be moved, which needs to happen before the
// state gets updated.
//

import path from "path";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { ProcessCanceled, UserCanceled } from "../../../util/CustomErrors";
import * as fs from "../../../util/fs";
import getNormalizeFunc from "../../../util/getNormalizeFunc";
import { log } from "../../../util/log";
import { batchDispatch, truthy } from "../../../util/util";
import { setCompatibleGames, setDownloadFilePath } from "../actions/state";
import { downloadPath, downloadPathForGame } from "../selectors";

async function setDownloadGames(
  api: IExtensionApi,
  dlId: string,
  gameIds: string[],
  withAddInProgress: (
    fileName: string,
    cb: () => PromiseLike<void>,
  ) => PromiseLike<void>,
  bypassProgressTracking: boolean = false,
) {
  const state = api.getState();
  const download = state.persistent.downloads.files[dlId];
  gameIds = gameIds.filter((x) => truthy(x));
  if (
    download?.localPath === undefined ||
    gameIds.length === 0 ||
    gameIds[0] === undefined
  ) {
    return;
  }

  const fromGameId = Array.isArray(download.game)
    ? download.game[0]
    : download.game;

  if (fromGameId !== gameIds[0]) {
    try {
      const moveOperation = async () => {
        const filePath = await moveDownload(
          state,
          download.localPath,
          fromGameId,
          gameIds[0],
        );
        // game may be undefined if the download is recognized but it's for a
        // game Vortex doesn't support
        const batched = [setCompatibleGames(dlId, gameIds)];
        const fileName = path.basename(filePath);
        // the name may have changed if the target path already existed because a counter would
        // have been appended
        if (fileName !== download.localPath) {
          batched.push(setDownloadFilePath(dlId, fileName) as any);
        }
        batchDispatch(api.store, batched);
      };

      // Use progress tracking for user-initiated moves, bypass for metadata-triggered moves
      if (bypassProgressTracking) {
        log("debug", "performing non-blocking game move for metadata update", {
          dlId,
          fromGameId,
          toGameId: gameIds[0],
        });
        return await moveOperation();
      } else {
        log("debug", "performing blocking game move for user action", {
          dlId,
          fromGameId,
          toGameId: gameIds[0],
        });
        return await withAddInProgress(download.localPath, moveOperation);
      }
    } catch (err) {
      if (err instanceof UserCanceled) {
        log("warn", "updating games for download canceled");
      } else if (err instanceof ProcessCanceled) {
        log("warn", "updating games for download failed", {
          error: err.message,
          from: err["oldPath"],
          to: err["newPath"],
        });
      } else {
        api.showErrorNotification("Failed to move download", err);
      }
    }
  } else {
    api.store.dispatch(setCompatibleGames(dlId, gameIds));
  }
  return;
}

async function moveDownload(
  state: IState,
  fileName: string,
  fromGameId: string,
  toGameId: string,
): Promise<string> {
  // removing the main game, have to move the download then
  const oldPath = truthy(fromGameId)
    ? downloadPathForGame(state, fromGameId)
    : downloadPath(state);
  const newPath = downloadPathForGame(state, toGameId);
  if (newPath === undefined) {
    return Promise.reject(
      new ProcessCanceled(`No download path for game ${toGameId}`),
    );
  }

  const normalize = await getNormalizeFunc(oldPath);
  const source = path.join(oldPath, fileName);
  const dest = path.join(newPath, fileName);
  if (normalize(source) === normalize(dest)) {
    const err = new ProcessCanceled("source same as destination");
    err["oldPath"] = oldPath;
    err["newPath"] = newPath;
    throw err;
  }
  await fs.ensureDirWritableAsync(newPath);
  try {
    const oStat = await fs
      .statAsync(oldPath)
      .catch((err) =>
        err.code === "ENOENT"
          ? Promise.resolve(undefined)
          : Promise.reject(err),
      );
    const nStat = await fs.statAsync(newPath);
    if (!!oStat && oStat.ino === nStat.ino) {
      const err = new ProcessCanceled("source same as destination");
      err["oldPath"] = oldPath;
      err["newPath"] = newPath;
      throw err;
    } else {
      if (!oStat) return Promise.resolve(dest);
    }
  } catch (err) {
    log("error", "failed to stat source or dest on move", err);
  }
  return fs
    .moveRenameAsync(source, dest)
    .catch((err) =>
      err.code === "ENOENT" ? Promise.resolve(dest) : Promise.reject(err),
    );
}

export default setDownloadGames;
