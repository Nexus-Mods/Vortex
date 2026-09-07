import * as path from "path";

import { actions, fs, log, selectors, types, util } from "@nexusmods/vortex-api";
import type { Action } from "redux";

import { setPluginEnabled } from "../actions/loadOrder";
import { incrementNewPluginCounter } from "../actions/plugins";
import { GHOST_EXT, NAMESPACE } from "../statics";
import { gameSupported, pluginExtensions } from "./gameSupport";

function notifyMultiplePlugins(
  api: types.IExtensionApi,
  mod: types.IMod,
  profile: types.IProfile,
  plugins: string[],
) {
  const t = api.translate;
  const { store } = api;
  const modName = util.renderModName(mod, { version: false });
  api.sendNotification({
    id: `multiple-plugins-${mod.id}`,
    type: "info",
    message: t('The mod "{{ modName }}" contains multiple plugins', {
      replace: { modName },
      ns: NAMESPACE,
    }),
    replace: {
      modName,
      modId: mod.id,
      tag: mod.attributes?.referenceTag,
    },
    actions: [
      {
        title: "Show",
        action: (dismiss) => {
          const stateNow: types.IState = store.getState();
          const gameModeNow = selectors.activeGameId(stateNow);
          if (gameModeNow === profile.gameId) {
            api.events.emit("show-main-page", "gamebryo-plugins");
            store.dispatch(actions.setAttributeVisible("gamebryo-plugins", "modName", true));
            store.dispatch(actions.setAttributeFilter("gamebryo-plugins", "modName", modName));
          } else {
            api.sendNotification({
              type: "info",
              message: t('Please activate "{{ gameId }}" to enable plugins manually', {
                replace: { gameId: profile.gameId },
                ns: NAMESPACE,
              }),
            });
          }

          dismiss();
        },
      },
      {
        title: "Enable all",
        action: (dismiss) => {
          plugins.forEach((plugin) => api.store.dispatch(setPluginEnabled(plugin, true)));
          dismiss();
        },
      },
    ],
  });
}

/**
 * 'mod-enabled' handler: when enabling a mod we automatically enable its plugin, if there is
 * (exactly) one. If there are more the user gets a notification asking whether to enable all.
 */
export async function handleModEnabled(
  api: types.IExtensionApi,
  profileId: string,
  modId: string,
): Promise<void> {
  const state: types.IState = api.store.getState();
  const currentProfile = selectors.activeProfile(state);
  if (currentProfile === undefined) {
    return;
  }

  if (profileId !== currentProfile.id || !gameSupported(currentProfile.gameId)) {
    return;
  }

  const mod: types.IMod = state.persistent.mods[currentProfile.gameId][modId];
  if (mod === undefined) {
    log("error", "newly activated mod not found", {
      profileId,
      modId,
    });
    return;
  }

  // sampled before the directory read so a tail-of-install member does not lose the session
  const collectionInstallActive = selectors.getCollectionActiveSession(state) !== undefined;

  let files: string[];
  try {
    files = await fs.readdirAsync(path.join(selectors.installPath(state), mod.installationPath));
  } catch (err) {
    if (err instanceof util.ProcessCanceled || err instanceof util.UserCanceled) {
      return;
    }
    if (err.code === "ENOENT") {
      api.showErrorNotification(
        "A mod could no longer be found on disk. Please don't delete mods manually " +
          "but uninstall them through Vortex.",
        err,
        { allowReport: false },
      );
      api.store.dispatch(actions.removeMod(currentProfile.gameId, modId));
    } else {
      api.showErrorNotification("Failed to read mod", err);
    }
    return;
  }

  const plugins = files
    .filter(
      (fileName) =>
        pluginExtensions(currentProfile.gameId).indexOf(path.extname(fileName).toLowerCase()) !==
        -1,
    )
    .map((fileName) => path.basename(fileName, GHOST_EXT));

  if (plugins.length === 0) {
    return;
  }

  // A mod enabled during a collection install gets every plugin enabled, regardless of
  // plugin count or automation settings; the postprocess parser applies the curator's
  // explicit states on top.
  if (
    plugins.length === 1 ||
    collectionInstallActive ||
    mod.attributes?.enableallplugins === true
  ) {
    const batched: Action[] = plugins.map((plugin) => setPluginEnabled(plugin, true));
    batched.push(incrementNewPluginCounter(plugins.length));
    util.batchDispatch(api.store, batched);
  } else {
    notifyMultiplePlugins(api, mod, currentProfile, plugins);
  }
}
