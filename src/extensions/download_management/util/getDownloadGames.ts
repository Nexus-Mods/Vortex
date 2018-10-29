import { IDownload } from '../types/IDownload';

function getDownloadGames(download: IDownload): string[] {
  if (Array.isArray(download.game)) {
    return download.game;
  } else if (download.game === undefined) {
    return [];
  } else {
    return [download.game];
  }
}

export default getDownloadGames;
