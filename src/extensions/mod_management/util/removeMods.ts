import Promise from 'bluebird';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { INotification } from '../../../types/INotification';
import { IState } from '../../../types/IState';

function removeMod(api: IExtensionApi, gameId: string, modId: string): Promise<void> {
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
  const state: IState = api.store.getState();

  if (modIds.length === 0) {
    return Promise.resolve();
  }

  const notiParams: INotification = {
    type: 'activity',
    title: 'Removing mods',
    message: '...',
  };

  notiParams.id = api.sendNotification({
    ...notiParams,
    progress: 0,
  });

  const mods = state.persistent.mods[gameId];

  return Promise
    .mapSeries(modIds, (modId: string, idx: number, length: number) => {
      api.sendNotification({
        ...notiParams,
        message: modId,
        progress: (idx * 100) / length,
      });
      if ((mods[modId] !== undefined)
        && (mods[modId].state === 'installed')) {
        return removeMod(api, gameId, modId);
      } else {
        return Promise.resolve();
      }
    })
    .then(() => {
      api.events.emit('mods-enabled', modIds, false, gameId);
    })
    .finally(() => {
      api.dismissNotification(notiParams.id);
    });
}
