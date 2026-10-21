import type { Action } from "redux";

import { startActivity, stopActivity } from "../../../../actions";
import type { IState } from "../../../../types/IState";
import type Debouncer from "../../../../util/Debouncer";
import { activeGameId } from "../../../../util/selectors";

/** The parts of the extension api auto-apply deploys through. */
interface IAutoDeployApi {
  getState: () => IState;
  store?: { dispatch: (action: Action) => unknown };
}

type DeploymentTimer = Pick<Debouncer, "schedule">;

/** Deploys on the deployment timer, shown as under way while it runs down. */
export const scheduleAutoDeploy = (api: IAutoDeployApi, deploymentTimer: DeploymentTimer) => {
  api.store.dispatch(startActivity("mods", "deployment_pending"));
  deploymentTimer.schedule(
    () => api.store.dispatch(stopActivity("mods", "deployment_pending")),
    false,
  );
};

/**
 * Deploys the active game's pending changes when auto-apply is turned on. Auto-apply only
 * deploys on the next mod change, and hides the Apply button, so changes already pending
 * would otherwise wait with nothing to apply them. A deploy already under way covers them.
 */
export const deployPendingOnAutoApply =
  (api: IAutoDeployApi, deploymentTimer: DeploymentTimer) =>
  (previous: boolean | undefined, current: boolean | undefined) => {
    if (previous || !current) {
      return;
    }

    const state = api.getState();
    if (!state.persistent.deployment.needToDeploy[activeGameId(state)]) {
      return;
    }

    if ((state.session.base.activity?.mods ?? []).includes("deployment")) {
      return;
    }

    scheduleAutoDeploy(api, deploymentTimer);
  };
