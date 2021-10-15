import { IExtensionApi } from '../../../types/IExtensionContext';
import { finalizingDownload, finalizingProgress,
         finishDownload, setDownloadHash } from '../actions/state';

import { util } from 'vortex-api';
import { fileMD5 } from 'vortexmt';

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

  return util.toPromise(cb => (fileMD5 as any)(filePath, cb, progressHash))
    .then((md5Hash: string) => {
      api.store.dispatch(setDownloadHash(id, md5Hash));
    })
    .finally(() => {
      // still storing the download as successful even if we didn't manage to calculate its
      // hash
      api.store.dispatch(finishDownload(id, 'finished', undefined));
      api.events.emit('did-finish-download', id, 'finished');
    });
}
