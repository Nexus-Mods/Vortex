import path from "path";

import { actions, fs, log, selectors, types, util } from "@nexusmods/vortex-api";
import semver from "semver";

import { GAME_ID, modsRelPath } from "./common";

const oldModRelPath = path.join("BloodstainedRotN", "Content", "Paks", "~mod");

export async function migrate100(api: types.IExtensionApi, oldVersion: string): Promise<void> {
  if (semver.gte(oldVersion || "0.0.1", "1.0.0")) return;

  const state = api.store.getState();
  const activatorId = selectors.activatorForGame(state, GAME_ID);
  const activator = util.getActivator(activatorId);

  const discovery = util.getSafe(state, ["settings", "gameMode", "discovered", GAME_ID], undefined);

  if (discovery === undefined || discovery.path === undefined || activator === undefined) {
    // if this game is not discovered or deployed there is no need to migrate
    log("debug", "skipping bloodstained migration because no deployment set up for it");
    return;
  }

  // would be good to inform the user beforehand but since this is run in the main process
  // and we can't currently show a (working) dialog from the main process it has to be
  // this way.
  await Promise.resolve(api.awaitUI());
  await Promise.resolve(fs.ensureDirWritableAsync(path.join(discovery.path, modsRelPath())));
  await Promise.resolve(
    api.emitAndAwait("purge-mods-in-path", GAME_ID, "", path.join(discovery.path, oldModRelPath)),
  );
  api.store.dispatch(actions.setDeploymentNecessary(GAME_ID, true));
}
