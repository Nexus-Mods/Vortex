/**
 * Lifecycle helpers for deploying SMAPI and activating it as primary tool.
 */
import type { types } from "vortex-api";
import { actions, selectors, util } from "vortex-api";

import { GAME_ID } from "../common";

/**
 * Deploys mods, re-runs quick discovery, and sets SMAPI as primary tool when
 * discovered.
 *
 * @param api Vortex extension API (`types.IExtensionApi`) used for deployment
 * events and state dispatch.
 * @returns Resolves after deployment/discovery completes and primary tool is
 * updated when available.
 */
export async function deploySMAPI(api: types.IExtensionApi): Promise<void> {
  await util.toPromise((cb) => api.events.emit("deploy-mods", cb));
  await util.toPromise((cb) => api.events.emit("start-quick-discovery", () => cb(null)));

  const discovery = selectors.discoveryByGame(api.getState(), GAME_ID);
  const tool = discovery?.tools?.["smapi"];
  if (tool !== undefined && api.store !== undefined) {
    api.store.dispatch(actions.setPrimaryTool(GAME_ID, tool.id));
  }
}
