import type InstallManager from "../InstallManager";
import type { IExtensionApi } from "../../../renderer/types/api";
import {
  getCollectionActiveSession,
  getCollectionCurrentPhase,
} from "../../collections_integration/selectors";
import type { IModsAPIExtension } from "../types/IModsAPIExtension";
import { log } from "../../../renderer/util/log";
import type { IDeployOptions } from "../types/IDeployOptions";

function extendAPI(
  api: IExtensionApi,
  installManager: InstallManager,
): IModsAPIExtension {
  const activeCollection = () => {
    const state = api.getState();
    return getCollectionActiveSession(state);
  };

  const activePhase = () => {
    const state = api.getState();
    const currentPhase = getCollectionCurrentPhase(state);
    return currentPhase;
  };

  return {
    awaitNextPhaseDeployment: async () => {
      // Await the deployment for the next phase of the active collection installation
      const collection = activeCollection();
      if (!collection) return;

      const phase = activePhase();

      log("info", "awaitNextPhaseDeployment called", {
        collectionId: collection.collectionId,
        phase,
      });

      // Schedule deployment and wait for pollPhaseSettlement to complete
      const deploymentPromise = installManager.scheduleDeployOnPhaseSettled(
        api,
        collection.collectionId,
        phase,
        true,
      );
      if (deploymentPromise) {
        await deploymentPromise;
      } else {
        log("info", "no deployment promise returned");
        return;
      }
    },

    awaitModsDeployment: async (
      profileId?: string,
      progressCB?: (text: string, percent: number) => void,
      deployOptions?: IDeployOptions,
    ) => {
      // Await the deployment of mods for the specified profile
      return new Promise<void>((resolve, reject) => {
        const callback = (err: Error) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        };
        api.events.emit(
          "deploy-mods",
          callback,
          profileId,
          progressCB,
          deployOptions,
        );
      });
    },
  };
}

export default extendAPI;
