import Promise from 'bluebird';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { INotification } from '../../../types/INotification';
import { toPromise } from '../../../util/util';

export function removeMod(api: IExtensionApi, gameId: string, modId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    api.events.emit('remove-mod', gameId, modId, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function removeMods(api: IExtensionApi, gameId: string, modIds: string[]): Promise<void> {
  const mods = api.getState().persistent.mods[gameId];
  if (modIds.length === 0) {
    return Promise.resolve();
  }

  const notiParams: INotification = {
    type: 'activity',
    title: 'Removing mods',
    message: '...',
    progress: 0,
  };

  notiParams.id = api.sendNotification({
    ...notiParams,
  });

  const progressCB = (idx: number, length: number, name: string) => {
    api.sendNotification({
      ...notiParams,
      message: name,
      progress: (idx * 100) / length,
    });
  };

  return toPromise(cb =>
      api.events.emit('remove-mods', gameId, modIds, cb, { progressCB }))
    .then(() => {
      api.events.emit('mods-enabled', modIds, false, gameId);
    })
    .finally(() => {
      api.dismissNotification(notiParams.id);
    });
}
