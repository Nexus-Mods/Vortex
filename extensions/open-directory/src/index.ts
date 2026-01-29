import { appDataPath, initGameSupport, settingsPath } from "./gameSupport";

import Promise from "bluebird";
import * as path from "path";
import { fs, selectors, types, util } from "vortex-api";

function init(context: types.IExtensionContext) {
  initGameSupport(context.api);
  context.registerAction(
    "mod-icons",
    300,
    "open-ext",
    {},
    "Open Mod Staging Folder",
    () => {
      const store = context.api.store;
      util
        .opn(selectors.installPath(store.getState()))
        .catch((err) => undefined);
    },
  );

  context.registerAction(
    "mod-icons",
    300,
    "open-ext",
    {},
    "Open Game Folder",
    () => {
      const state = context.api.store.getState();
      const gameId: string = selectors.activeGameId(state);
      getGameInstallPath(state, gameId)
        .then((installPath) => {
          openPath(installPath);
        })
        .catch((e) => {
          context.api.showErrorNotification("Failed to open game folder", e);
        });
    },
  );

  context.registerAction(
    "download-actions",
    100,
    "open-ext",
    {},
    "Open Folder",
    () => {
      const state = context.api.getState();
      const dlPath = selectors.downloadPath(state);
      util.opn(dlPath).catch(() => undefined);
    },
  );

  context.registerAction(
    "mod-icons",
    300,
    "open-ext",
    {},
    "Open Game Mods Folder",
    () => {
      const state = context.api.store.getState();
      const gameRef: types.IGame = util.getGame(selectors.activeGameId(state));
      getGameInstallPath(state, gameRef.id)
        .then((installPath) => {
          // Check if the extension provided us with a "custom" directory
          //  to open when the button is clicked - otherwise assume we
          //  just need to use the default queryModPath value.
          let modPath =
            !!gameRef.details && !!gameRef.details.customOpenModsPath
              ? gameRef.details.customOpenModsPath
              : gameRef.queryModPath(installPath);
          if (!path.isAbsolute(modPath)) {
            // We add a path separator at the end to avoid running executables
            //  instead of opening file explorer. This happens when the
            //  a game's mods folder is named like its executable.
            //  e.g. Vampire the Masquerade's default modding folder is ../Vampire/
            //  and within the same directory ../Vampire.exe exists as well.
            modPath = path.join(installPath, modPath) + path.sep;
          }

          openPath(modPath, installPath);
        })
        .catch((e) => {
          context.api.showErrorNotification(
            "Failed to open the game mods folder",
            e,
          );
        });
    },
  );

  context.registerAction(
    "mod-icons",
    300,
    "open-ext",
    {},
    "Open Game Settings Folder",
    () => {
      const state = context.api.getState();
      const gameId = selectors.activeGameId(state);
      const game = util.getGame(gameId);
      const target = settingsPath(game);
      if (target !== undefined) {
        openPath(target);
      }
    },
    () => {
      const state = context.api.getState();
      const gameId = selectors.activeGameId(state);
      const game = util.getGame(gameId);
      return settingsPath(game) !== undefined;
    },
  );

  context.registerAction(
    "mod-icons",
    300,
    "open-ext",
    {},
    "Open Game Application Data Folder",
    () => {
      const state = context.api.getState();
      const gameId = selectors.activeGameId(state);
      const game = util.getGame(gameId);
      const target = appDataPath(game);
      if (target !== undefined) {
        openPath(target);
      }
    },
    () => {
      const state = context.api.getState();
      const gameId = selectors.activeGameId(state);
      const game = util.getGame(gameId);
      return appDataPath(game) !== undefined;
    },
  );

  context.registerAction(
    "mods-action-icons",
    100,
    "open-ext",
    {},
    "Open in File Manager",
    (instanceIds: string[]) => {
      const store = context.api.store;
      const installPath = selectors.installPath(store.getState());
      const modPath = path.join(installPath, instanceIds[0]);
      openPath(modPath, installPath);
    },
    (instanceIds) => {
      const state: types.IState = context.api.store.getState();
      const gameMode = selectors.activeGameId(state);
      return (
        util.getSafe(
          state.persistent.mods,
          [gameMode, instanceIds[0]],
          undefined,
        ) !== undefined
      );
    },
  );

  context.registerAction(
    "mods-action-icons",
    100,
    "open-ext",
    {},
    "Open Archive",
    (instanceIds: string[]) => {
      const state = context.api.getState();
      const downloadPath = selectors.downloadPath(state);
      const mod = util.getSafe(
        state.persistent.mods,
        [selectors.activeGameId(state), instanceIds[0]],
        undefined,
      );
      const downloadId = mod?.archiveId ?? instanceIds[0];
      const download: types.IDownload = util.getSafe(
        state.persistent.downloads.files,
        [downloadId],
        undefined,
      );
      if (!download?.localPath) {
        context.api.showErrorNotification(
          "Failed to open mod archive",
          "The mod archive could not be found.",
          { allowReport: false },
        );
        return;
      }
      const modArchivePath = path.join(downloadPath, download.localPath);
      openPath(modArchivePath, downloadPath);
    },
    (instanceIds) => {
      const state: types.IState = context.api.store.getState();
      const gameMode = selectors.activeGameId(state);
      const mod = util.getSafe(
        state.persistent.mods,
        [gameMode, instanceIds[0]],
        undefined,
      );
      const downloadId = mod?.archiveId ?? instanceIds[0];
      return (
        util.getSafe(
          state.persistent.downloads.files,
          [downloadId],
          undefined,
        ) !== undefined
      );
    },
  );

  context.registerAction(
    "download-icons",
    300,
    "open-ext",
    {},
    "Open in File Manager",
    () => {
      const store = context.api.store;
      util
        .opn(selectors.downloadPath(store.getState()))
        .catch((err) => undefined);
    },
  );

  return true;
}

function getGameInstallPath(state: any, gameId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const discoveredPath: string = util.getSafe(
      state,
      ["settings", "gameMode", "discovered", gameId, "path"],
      undefined,
    );
    if (discoveredPath === undefined) {
      reject(new Error(`Could not resolve game path for "${gameId}"`));
    } else {
      resolve(discoveredPath);
    }
  });
}

function openPath(mainPath: string, fallbackPath?: string) {
  fs.statAsync(mainPath)
    .then(() => util.opn(mainPath).catch(() => undefined))
    .catch(() =>
      fallbackPath !== undefined
        ? util.opn(fallbackPath).catch(() => undefined)
        : undefined,
    )
    .then(() => null);
}

export default init;
