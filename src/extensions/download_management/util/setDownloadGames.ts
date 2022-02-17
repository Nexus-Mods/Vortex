//
// Functions for changing game id on a download.
// Since we arrange downloads into directories based on the "primary" game,
// changing the game id may cause a file to be moved, which needs to happen before the
// state gets updated.
//

import path from 'path';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { IGame } from '../../../types/IGame';
import { IState } from '../../../types/IState';
import { ProcessCanceled, UserCanceled } from '../../../util/CustomErrors';
import * as fs from '../../../util/fs';
import { log } from '../../../util/log';
import { truthy } from '../../../util/util';
import { getGame } from '../../gamemode_management/util/getGame';
import { setCompatibleGames, setDownloadFilePath } from '../actions/state';
import { downloadPath, downloadPathForGame } from '../selectors';

async function setDownloadGames(
  api: IExtensionApi,
  dlId: string,
  gameIds: string[],
  withAddInProgress: (fileName: string, cb: () => PromiseLike<void>) => PromiseLike<void>) {

  const state = api.getState();
  const download = state.persistent.downloads.files[dlId];

  if (download === undefined) {
    return Promise.resolve();
  }

  const fromGameId = (Array.isArray(download.game) ? download.game[0] : download.game);

  if (fromGameId !== gameIds[0]) {
    try {
      return await withAddInProgress(download.localPath, async () => {
        const filePath = await moveDownload(state, download.localPath, fromGameId, gameIds[0]);
        const game: IGame | undefined = getGame(gameIds[0]);
        // game may be undefined if the download is recognized but it's for a
        // game Vortex doesn't support
        api.sendNotification({
          type: 'success',
          title: 'Download moved to game {{gameName}}',
          message: download.localPath,
          replace: {
            gameName: game?.name ?? gameIds[0],
          },
        });
        api.store.dispatch(setCompatibleGames(dlId, gameIds));
        const fileName = path.basename(filePath);
        // the name may have changed if the target path already existed because a counter would
        // have been appended
        if (fileName !== download.localPath) {
          api.store.dispatch(setDownloadFilePath(dlId, fileName));
        }
      });
    } catch (err) {
      if ((err instanceof ProcessCanceled)
          || (err instanceof UserCanceled)) {
        log('warn', 'updating games for download failed', { error: err.message });
      } else {
        api.showErrorNotification('Failed to move download', err);
      }
    }
  } else {
    api.store.dispatch(setCompatibleGames(dlId, gameIds));
  }
}

async function moveDownload(state: IState, fileName: string, fromGameId: string, toGameId: string)
    : Promise<string> {
  // removing the main game, have to move the download then
  const oldPath = truthy(fromGameId)
    ? downloadPathForGame(state, fromGameId)
    : downloadPath(state);
  const newPath = downloadPathForGame(state, toGameId);
  const source = path.join(oldPath, fileName);
  const dest = path.join(newPath, fileName);
  if (source === dest) {
    throw new ProcessCanceled('source same as destination');
  }
  await fs.ensureDirWritableAsync(newPath);
  return fs.moveRenameAsync(source, dest);
}

export default setDownloadGames;
