import { genHash, IHashResult } from 'modmeta-db';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { finalizingDownload, finalizingProgress, finishDownload, setDownloadHash } from '../actions/state';

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

  return genHash(filePath, progressHash)
    .then((md5Hash: IHashResult) => {
      api.store.dispatch(setDownloadHash(id, md5Hash.md5sum));
    })
    .finally(() => {
      // still storing the download as successful even if we didn't manage to calculate its
      // hash
      api.store.dispatch(finishDownload(id, 'finished', undefined));
      this.mApi.events.emit('did-finish-download', id, 'finished');
      const state = api.getState();
      if (state.settings.automation?.install && allowInstall) {
        api.events.emit('start-install-download', id);
      }
    });
}
