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
 * finishes later. A deployment that ends without did-deploy (canceled, or failed) hands off to
 * onDeployAborted instead, since it may have changed the Data folder while nobody watched.
 */
export function startDeployWatcher(
  api: IExtensionApi,
  onDidDeploy: (profileId: string) => PromiseLike<void>,
  onDeployAborted: () => void,
): IDeployWatcher {
  let deploying = false;
  let pluginsChangedQueued = false;

  const drainPluginsChanged = () => {
    if (pluginsChangedQueued) {
      pluginsChangedQueued = false;
      api.events.emit("trigger-test-run", "plugins-changed", 500);
    }
  };

  api.onAsync("will-deploy", () => {
    deploying = true;
    return Promise.resolve();
  });

  // will-deploy only fires inside the "deployment" mod activity, and did-deploy clears the flag
  // before that activity stops. So the activity stopping while the flag is still set means the
  // deployment never reached did-deploy; without this, the Data folder watcher and the
  // plugins-changed check would stay muted for the rest of the session.
  api.onStateChange(["session", "base", "activity", "mods"], (_previous, current: string[]) => {
    if (deploying && !(current ?? []).includes("deployment")) {
      deploying = false;
      drainPluginsChanged();
      onDeployAborted();
    }
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
      drainPluginsChanged();
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
