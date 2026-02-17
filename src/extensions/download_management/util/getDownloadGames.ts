import { log } from "../../../renderer/util/log";
import type { IDownload } from "../types/IDownload";

function getDownloadGames(download: IDownload): string[] {
  if (Array.isArray(download.game)) {
    return download.game;
  } else if (download.game === undefined) {
    log("warn", "download with no game associated", JSON.stringify(download));
    return [];
  } else {
    return [download.game];
  }
}

export default getDownloadGames;
