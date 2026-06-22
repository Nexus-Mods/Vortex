import { unknownToError } from "@vortex/shared";

import type { IMod, IModRule } from "../../../extensions/mod_management/types/IMod";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { MOD_TYPE } from "../constants";

export async function createCollection(
  api: IExtensionApi,
  gameId: string,
  id: string,
  name: string,
  rules: IModRule[],
) {
  const state: IState = api.store.getState();

  const mod: IMod = {
    id,
    type: MOD_TYPE,
    state: "installed",
    attributes: {
      name,
      version: "0",
      installTime: new Date().toString(),
      author: state.persistent["nexus"]?.userInfo?.name ?? "Anonymous",
      uploader: state.persistent["nexus"]?.userInfo?.name ?? "Anonymous",
      uploaderId: state.persistent["nexus"]?.userInfo?.user_id,
      editable: true,
      source: "user-generated",
      recommendNewProfile: false,
    },
    installationPath: id,
    rules,
  };

  try {
    await new Promise<void>((resolve, reject) => {
      api.events.emit("create-mod", gameId, mod, (error: Error) => {
        if (error !== null) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    api.showErrorNotification("Failed to create collection", unknownToError(err));
  }
}
