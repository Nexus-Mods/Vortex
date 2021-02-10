import { genHash, IHashResult } from 'modmeta-db';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { finalizingDownload, finishDownload, setDownloadHash } from '../actions/state';

export function finalizeDownload(api: IExtensionApi, id: string,
                                 filePath: string, allowInstall: boolean) {
  api.store.dispatch(finalizingDownload(id));

  return genHash(filePath)
    .then((md5Hash: IHashResult) => {
      api.store.dispatch(setDownloadHash(id, md5Hash.md5sum));
    })
    .finally(() => {
      // still storing the download as successful even if we didn't manage to calculate its
      // hash
      api.store.dispatch(finishDownload(id, 'finished', undefined));
      const state = api.getState();
      if (state.settings.automation?.install && allowInstall) {
        api.events.emit('start-install-download', id);
      }
    });
}
