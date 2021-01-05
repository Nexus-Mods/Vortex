import { log } from '../../../util/log';
import { IDownload } from '../types/IDownload';

function getDownloadGames(download: IDownload): string[] {
  if (Array.isArray(download.game)) {
    return download.game;
  } else if (download.game === undefined) {
    log('warn', 'download with no game associated', JSON.stringify(download));
    return [];
  } else {
    return [download.game];
  }
}

export default getDownloadGames;
