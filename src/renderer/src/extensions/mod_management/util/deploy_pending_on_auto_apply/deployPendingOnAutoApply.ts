import { startActivity, stopActivity } from "../../../../actions";
import type { IExtensionApi } from "../../../../types/IExtensionContext";
import type Debouncer from "../../../../util/Debouncer";
import { activeGameId } from "../../../../util/selectors";

/** Deploys on the deployment timer, shown as under way while it runs down. */
export const scheduleAutoDeploy = (api: IExtensionApi, deploymentTimer: Debouncer) => {
  api.store.dispatch(startActivity("mods", "deployment_pending"));
  deploymentTimer.schedule(
    () => api.store.dispatch(stopActivity("mods", "deployment_pending")),
    false,
  );
};

/**
 * Deploys the active game's pending changes when auto-apply is turned on. Auto-apply only
 * deploys on the next mod change, and hides the Apply button, so changes already pending
 * would otherwise wait with nothing to apply them.
 */
export const deployPendingOnAutoApply =
  (api: IExtensionApi, deploymentTimer: Debouncer) =>
  (previous: boolean | undefined, current: boolean | undefined) => {
    if (previous || !current) {
      return;
    }

    const state = api.getState();
    if (!state.persistent.deployment.needToDeploy[activeGameId(state)]) {
      return;
    }

    scheduleAutoDeploy(api, deploymentTimer);
  };
