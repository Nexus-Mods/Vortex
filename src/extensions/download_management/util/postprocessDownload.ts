import { IExtensionApi } from '../../../types/IExtensionContext';
import { delayed, toPromise } from '../../../util/util';
import { finalizingDownload, finalizingProgress,
         finishDownload, setDownloadHash } from '../actions/state';
import queryInfo from './queryDLInfo';

import { fileMD5 } from 'vortexmt';

function fileMD5Async(filePath: string,
                      progressFunc: (progress: number, total: number) => void)
                      : Promise<string> {
  return Promise.resolve(toPromise(cb => fileMD5(filePath, cb, progressFunc)));
}

export function finalizeDownload(api: IExtensionApi, id: string,
                                 filePath: string, allowInstall: boolean) {
  api.store.dispatch(finalizingDownload(id));

  let lastProgress: number = 0;
  const progressHash = (progress: number, total: number) => {
    const prog = Math.floor(progress * 100 / total);
    if (prog > lastProgress) {
      lastProgress = prog;
      api.store.dispatch(finalizingProgress(id, progress));
    }
  };

  return fileMD5Async(filePath , progressHash)
    .catch(err => {
      if (['EBUSY', 'ENOENT', 'EPERM'].includes(err.code)) {
        // try a second time, might be the AV interfering with the new file
        return delayed(1000).then(() => fileMD5Async(filePath, progressHash))
      }
      return Promise.reject(err);
    })
    .then((md5Hash: string) => {
      api.store.dispatch(setDownloadHash(id, md5Hash));
    })
    .then(() => {
      api.store.dispatch(finishDownload(id, 'finished', undefined));
      return queryInfo(api, [id], false);
    })
    .finally(() => {
      // still storing the download as successful even if we didn't manage to calculate its
      // hash
      api.store.dispatch(finishDownload(id, 'finished', undefined));
      api.events.emit('did-finish-download', id, 'finished');
    });
}
