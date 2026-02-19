import path from "path";
import semver from "semver";
import { actions, fs, selectors, types, util } from "vortex-api";

import { DA_GAMES } from "./constants";

export async function migrate100(context, oldVersion): Promise<void> {
  if (semver.gte(oldVersion, "1.0.0")) {
    return Promise.resolve();
  }

  const da2Game = DA_GAMES.DragonAge2;
  const state = context.api.getState();
  const discovery: types.IDiscoveryResult = selectors.discoveryByGame(
    state,
    da2Game.id,
  );

  const activatorId = selectors.activatorForGame(state, da2Game.id);
  const activator = util.getActivator(activatorId);
  if (!discovery?.path || !activator) {
    return Promise.resolve();
  }

  const mods: { [modId: string]: types.IMod } = util.getSafe(
    state,
    ["persistent", "mods", da2Game.id],
    {},
  );
  const addins = Object.values(mods).filter((mod) => mod.type === "dazip");

  if (addins.length === 0) {
    // No mods - no problem.
    return Promise.resolve();
  }

  const modsPath = path.join(discovery.path, da2Game.modPath);
  return context.api
    .awaitUI()
    .then(() => fs.ensureDirWritableAsync(modsPath))
    .then(() =>
      context.api.emitAndAwait(
        "purge-mods-in-path",
        da2Game.id,
        "dazip",
        modsPath,
      ),
    )
    .then(() =>
      context.api.store.dispatch(
        actions.setDeploymentNecessary(da2Game.id, true),
      ),
    );
}
