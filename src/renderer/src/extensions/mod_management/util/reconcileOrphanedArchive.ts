import { stat } from "node:fs/promises";
import * as path from "path";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { downloadPathForGame } from "../../../util/selectors";

/**
 * Guard against an orphaned archive: a file present in the game's download folder with no matching
 * download record. A collection (re)install starts each dependency download with the redownload
 * disposition "never", so the download adapter reuses the on-disk file's existing record; when that
 * record is gone the lookup finds nothing and the download is left hanging. Rebuilding the records
 * via refresh-downloads first lets the reuse path resolve. Resolves immediately when the file is
 * absent or already tracked, so it is a no-op on the normal path.
 */
export async function reconcileOrphanedArchive(
  api: IExtensionApi,
  gameId: string,
  fileName?: string,
): Promise<void> {
  if (fileName === undefined || fileName === "") {
    return;
  }
  const state = api.getState();
  const alreadyTracked = Object.values(state.persistent.downloads.files).some(
    (dl) => dl.localPath === fileName,
  );
  if (alreadyTracked) {
    return;
  }
  const dlPath = downloadPathForGame(state, gameId);
  const onDisk = await stat(path.join(dlPath, fileName)).then(
    () => true,
    () => false,
  );
  if (!onDisk) {
    return;
  }
  log("info", "reconciling orphaned archive before download", { fileName, gameId });
  await new Promise<void>((resolve) => {
    api.events.emit("refresh-downloads", gameId, () => resolve());
  });
}
