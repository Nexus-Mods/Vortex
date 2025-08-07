import { IExtensionApi } from '../../../types/IExtensionContext';
import { delayed, toPromise } from '../../../util/util';
import { log } from '../../../util/log';
import { finalizingDownload, finalizingProgress,
         finishDownload, setDownloadHash } from '../actions/state';
import queryInfo from './queryDLInfo';
import { batchDispatch } from '../../../util/util';

import { fileMD5 } from 'vortexmt';

function fileMD5Async(filePath: string,
                      progressFunc: (progress: number, total: number) => void)
                      : Promise<string> {
  return Promise.resolve(toPromise<string>(cb => fileMD5(filePath, cb, progressFunc)));
}

export function finalizeDownload(api: IExtensionApi, id: string,
                                 filePath: string) {
  api.store.dispatch(finalizingDownload(id));

  let lastProgress: number = 0;
  const progressHash = (progress: number, total: number) => {
    const prog = Math.floor(progress * 100 / total);
    if (prog - lastProgress >= 10) {
      lastProgress = prog;
      api.store.dispatch(finalizingProgress(id, progress));
    }
  };
  return fileMD5Async(filePath , progressHash)
    .catch(err => {
      if (['EBUSY', 'ENOENT', 'EPERM'].includes(err.code)) {
        // try a second time, might be the AV interfering with the new file
        return delayed(100).then(() => fileMD5Async(filePath, progressHash))
      }
      return Promise.reject(err);
    })
    .then((md5Hash: string) => {;
      const batched = [
        setDownloadHash(id, md5Hash),
        finishDownload(id, 'finished', undefined)
      ];
      batchDispatch(api.store, batched);
      api.events.emit('did-finish-download', id, 'finished');

      // Run metadata lookup asynchronously without blocking download completion
      queryInfo(api, [id], false).catch(err => {
        // Log error but don't fail the download
        log('warn', 'Failed to query download metadata', err.message);
      });
      return Promise.resolve();
    })
    .catch(err => {
      // If MD5 calculation fails, still mark download as finished
      api.store.dispatch(finishDownload(id, 'finished', undefined));
      api.events.emit('did-finish-download', id, 'finished');
      log('error', 'Failed MD5 calculation', {
        id,
        filePath,
        error: err.message,
        stack: err.stack
      });
    });
}
