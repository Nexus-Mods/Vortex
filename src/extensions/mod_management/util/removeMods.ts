import PromiseBB from "bluebird";
import type { IExtensionApi } from "../../../renderer/types/IExtensionContext";
import type { INotification } from "../../../renderer/types/INotification";
import { toPromise } from "../../../renderer/util/util";

export function removeMod(
  api: IExtensionApi,
  gameId: string,
  modId: string,
): PromiseBB<void> {
  return new PromiseBB((resolve, reject) => {
    api.events.emit("remove-mod", gameId, modId, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function removeMods(
  api: IExtensionApi,
  gameId: string,
  modIds: string[],
): PromiseBB<void> {
  if (modIds.length === 0) {
    return PromiseBB.resolve();
  }

  const notiParams: INotification = {
    type: "activity",
    title: "Removing mods",
    message: "...",
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

  return toPromise((cb) =>
    api.events.emit("remove-mods", gameId, modIds, cb, { progressCB }),
  )
    .then(() => {
      api.events.emit("mods-enabled", modIds, false, gameId);
    })
    .finally(() => {
      api.dismissNotification(notiParams.id);
    });
}
