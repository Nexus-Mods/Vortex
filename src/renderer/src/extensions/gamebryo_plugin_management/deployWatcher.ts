import type { IExtensionApi } from "../../types/IExtensionContext";
import { getCollectionActiveSession } from "../../util/collectionInstallSessionSelectors";

export interface IDeployWatcher {
  isDeploying: () => boolean;
}

/**
 * Tracks deployment activity for the plugin-management extension. While a deployment runs, a
 * loadOrder change queues the plugins-changed health-test trigger instead of emitting it; the
 * queue drains once on did-deploy. did-deploy and did-purge hand off to the given onDidDeploy,
 * except deployments belonging to a collection session, which collection-postprocess-complete
 * finishes later.
 */
export function startDeployWatcher(
  api: IExtensionApi,
  onDidDeploy: (profileId: string) => PromiseLike<void>,
): IDeployWatcher {
  let deploying = false;
  let pluginsChangedQueued = false;

  api.onAsync("will-deploy", () => {
    deploying = true;
    return Promise.resolve();
  });

  // this handles the case that the content of a profile changes
  api.onAsync(
    "did-deploy",
    (
      profileId: string,
      _deployment,
      _progressCB,
      deployOptions?: { isCollectionPostprocessCall?: boolean },
    ) => {
      deploying = false;
      if (pluginsChangedQueued) {
        pluginsChangedQueued = false;
        api.events.emit("trigger-test-run", "plugins-changed", 500);
      }
      if (
        deployOptions?.isCollectionPostprocessCall ||
        getCollectionActiveSession(api.getState()) !== undefined
      ) {
        // handled in 'collection-postprocess-complete' event
        return Promise.resolve();
      }
      return onDidDeploy(profileId);
    },
  );

  api.onAsync("did-purge", (profileId: string) => {
    return onDidDeploy(profileId);
  });

  api.onStateChange(["loadOrder"], () => {
    if (deploying) {
      pluginsChangedQueued = true;
    } else {
      api.events.emit("trigger-test-run", "plugins-changed", 500);
    }
  });

  return { isDeploying: () => deploying };
}
