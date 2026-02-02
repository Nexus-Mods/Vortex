import {
  clearSavegames,
  removeSavegame,
  setSavegamePath,
  setSavegames,
  showTransferDialog,
} from "./actions/session";
import { sessionReducer } from "./reducers/session";
import { settingsReducer } from "./reducers/settings";
import { ISavegame } from "./types/ISavegame";
import {
  gameSupported,
  iniPath,
  initGameSupport,
  mygamesPath,
  saveFiles,
} from "./util/gameSupport";
import { profileSavePath } from "./util/profileSavePath";
import { refreshSavegames } from "./util/refreshSavegames";
import restoreSavegamePlugins, {
  MissingPluginsError,
} from "./util/restoreSavegamePlugins";
import transferSavegames from "./util/transferSavegames";
import SavegameList from "./views/SavegameList";

import Promise from "bluebird";
import * as _ from "lodash";
import * as path from "path";
import * as Redux from "redux";
import { actions, fs, log, selectors, types, util } from "vortex-api";
import { IniFile } from "vortex-parse-ini";
import { CORRUPTED_NAME } from "./constants";

function applySaveSettings(
  api: types.IExtensionApi,
  profile: types.IProfile,
  iniFile: IniFile<any>,
) {
  const savePath = profileSavePath(profile);

  if (iniFile.data.General === undefined) {
    iniFile.data.General = {};
  }
  // TODO: we should provide a way for the user to set his own
  //   save path without overwriting it
  iniFile.data.General.SLocalSavePath = savePath;

  const { store } = api;
  store.dispatch(setSavegamePath(savePath));
}

function saveDictEqual(
  lhs: { [id: string]: ISavegame },
  rhs: { [id: string]: ISavegame },
): boolean {
  if (!_.isEqual(Object.keys(lhs).sort(), Object.keys(rhs).sort())) {
    return false;
  }

  const compareDate = (key) => {
    let lDate = lhs[key].attributes.creationtime;
    let rDate = rhs[key].attributes.creationtime;
    if (lDate === undefined || rDate === undefined) {
      return true;
    }
    if (typeof lDate === "string") {
      lDate = new Date(lDate);
    }
    if (typeof rDate === "string") {
      rDate = new Date(rDate);
    }

    return lDate.getTime() === rDate.getTime();
  };

  return Object.keys(lhs).find((key) => !compareDate(key)) === undefined;
}

function updateSaves(
  store: Redux.Store<any>,
  savesPath: string,
): Promise<string[]> {
  const newSavegames: ISavegame[] = [];

  return refreshSavegames(
    savesPath,
    (save: ISavegame): void => {
      if (store.getState().session.saves[save.id] === undefined) {
        newSavegames.push(save);
      }
    },
    true,
  )
    .then(({ failedReads, truncated }) =>
      Promise.resolve({ newSavegames, failedReads, truncated }),
    )
    .then(
      (result: {
        newSavegames: ISavegame[];
        failedReads: string[];
        truncated: boolean;
      }) => {
        const savesDict: { [id: string]: ISavegame } = {};
        result.newSavegames.forEach((save: ISavegame) => {
          savesDict[save.id] = save;
        });

        const state = store.getState();
        const oldSaves: { [id: string]: ISavegame } = state.session.saves.saves;

        if (!saveDictEqual(oldSaves, savesDict)) {
          store.dispatch(setSavegames(savesDict, result.truncated));
        }
        return Promise.resolve(result.failedReads);
      },
    );
}

function genUpdateSavegameHandler(api: types.IExtensionApi) {
  return (profileId: string, savesPath: string) => {
    if (!util.getApplication().isFocused) {
      return Promise.resolve();
    }

    api.store.dispatch(actions.startActivity("savegames", "Loading"));

    return updateSaves(api.store, savesPath)
      .then((failedReadsInner: string[]) => {
        if (failedReadsInner.length > 0) {
          api.sendNotification({
            id: "saves-not-read",
            type: "error",
            message: "Some saves couldn't be read",
            actions: [
              {
                title: "Show",
                action: () => {
                  api.events.emit("show-main-page", "gamebryo-savegames");
                  api.store.dispatch(
                    actions.setAttributeFilter(
                      "savegames",
                      "name",
                      CORRUPTED_NAME,
                    ),
                  );
                },
              },
            ],
          });
        }
      })
      .catch((err) => {
        api.showErrorNotification("Failed to read save games", err, {
          id: "saves-not-read",
        });
      })
      .finally(() => {
        api.store.dispatch(actions.stopActivity("savegames", "Loading"));
      });
  };
}

function getSavesPath(profile: types.IProfile) {
  const savePath = profileSavePath(profile);

  return path.join(mygamesPath(profile.gameId), savePath);
}

function openSavegamesDirectory(api: types.IExtensionApi, profileId?: string) {
  const state: types.IState = api.store.getState();
  if (profileId === undefined) {
    profileId = selectors.activeProfile(state).id;
  }
  const profile = state.persistent.profiles[profileId];
  const hasLocalSaves = util.getSafe(
    profile,
    ["features", "local_saves"],
    false,
  );
  const profileSavesPath = hasLocalSaves
    ? path.join(mygamesPath(profile.gameId), "Saves", profile.id)
    : path.join(mygamesPath(profile.gameId), "Saves");
  fs.ensureDirAsync(profileSavesPath)
    .then(() => util.opn(profileSavesPath))
    .catch((err) =>
      api.showErrorNotification("Failed to open savegame directory", err, {
        allowReport: (err as any).code !== "ENOENT",
      }),
    );
}

interface IExtensionContextExt extends types.IExtensionContext {
  registerProfileFeature: (
    featureId: string,
    type: string,
    icon: string,
    label: string,
    description: string,
    supported: () => boolean,
  ) => void;
}

function updateSavegames(api: types.IExtensionApi, update: util.Debouncer) {
  const state = api.store.getState();
  const profile = selectors.activeProfile(state);

  if (profile === undefined) {
    return Promise.resolve();
  }

  if (!gameSupported(profile.gameId)) {
    return Promise.resolve();
  }

  const savesPath = getSavesPath(profile);

  update.schedule(undefined, profile.id, savesPath);
}

function onProfileChange(
  api: types.IExtensionApi,
  profileId: string,
  update: util.Debouncer,
) {
  const { store } = api;
  const state = store.getState();

  if (profileId === undefined) {
    return;
  }

  const prof = selectors.profileById(state, profileId);
  if (!gameSupported(prof.gameId)) {
    return;
  }

  const savePath = profileSavePath(prof);
  store.dispatch(setSavegamePath(savePath));
}

function onProfilesModified(
  store: Redux.Store<any>,
  update: util.Debouncer,
  oldProfiles: { [profileId: string]: types.IProfile },
  newProfiles: { [profileId: string]: types.IProfile },
) {
  const prof = selectors.activeProfile(store.getState());
  if (prof === undefined) {
    return;
  }

  const localSavesBefore = util.getSafe(
    oldProfiles,
    [prof.id, "features", "local_saves"],
    false,
  );
  const localSavesAfter = util.getSafe(
    newProfiles,
    [prof.id, "features", "local_saves"],
    false,
  );

  if (localSavesBefore !== localSavesAfter) {
    store.dispatch(clearSavegames());
    const savePath = profileSavePath(prof);
    const savesPath = path.join(mygamesPath(prof.gameId), savePath);
    store.dispatch(setSavegamePath(savePath));
    update.schedule(undefined, prof.id, savesPath);
  }
}

function once(context: types.IExtensionContext, update: util.Debouncer) {
  const store: Redux.Store<any> = context.api.store;

  context.api.setStylesheet(
    "savegame-management",
    path.join(__dirname, "savegame_management.scss"),
  );

  context.api.onStateChange(
    ["persistent", "profiles"],
    (
      oldProfiles: { [profileId: string]: types.IProfile },
      newProfiles: { [profileId: string]: types.IProfile },
    ) => {
      onProfilesModified(store, update, oldProfiles, newProfiles);
    },
  );

  context.api.onStateChange(
    ["settings", "gameMode", "discovered"],
    (previous, current) => {
      updateSavegames(context.api, update);
    },
  );

  context.api.onAsync(
    "apply-settings",
    (prof: types.IProfile, filePath: string, ini: IniFile<any>) => {
      log("debug", "apply savegame settings", {
        gameId: prof.gameId,
        filePath,
      });
      if (
        gameSupported(prof.gameId) &&
        filePath.toLowerCase() === iniPath(prof.gameId).toLowerCase()
      ) {
        applySaveSettings(context.api, prof, ini);
        store.dispatch(clearSavegames());
        const savePath = profileSavePath(prof);
        const savesPath = path.join(mygamesPath(prof.gameId), savePath);
        update.schedule(undefined, prof.id, savesPath);
      }
      return Promise.resolve(undefined);
    },
  );

  context.api.onAsync(
    "did-remove-profile",
    (res: undefined, profile: types.IProfile) => {
      if (
        gameSupported(profile.gameId) &&
        (profile.features?.["local_saves"] ?? false)
      ) {
        const savePath = profileSavePath(profile);
        const savesPath = path.join(mygamesPath(profile.gameId), savePath);
        context.api
          .showDialog(
            "question",
            "Profile deleted",
            {
              text:
                "The profile you just deleted had savegames associated with it. " +
                "Do you want to remove those savegames now? If you don't, they " +
                "will still be on disk in {{savesPath}} but they won't show up " +
                "in the game until you move them.",
              parameters: {
                savesPath,
              },
              links: [
                {
                  label: "Open Directory",
                  action: () => {
                    util.opn(savesPath);
                  },
                },
              ],
            },
            [{ label: "Cancel" }, { label: "Remove" }],
          )
          .then((result) => {
            if (result.action === "Remove") {
              return fs.removeAsync(savesPath).catch((err) => {
                if (err instanceof util.UserCanceled) {
                  return;
                }
                context.api.showErrorNotification(
                  "Failed to remove savegame",
                  err,
                  {
                    allowReport: false,
                  },
                );
              });
            }
          });
      } else {
        return Promise.resolve();
      }
    },
  );

  context.api.events.on("profile-did-change", (profileId: string) =>
    onProfileChange(context.api, profileId, update),
  );

  const onFocus = () => {
    updateSavegames(context.api, update);
  };
  window.addEventListener("focus", onFocus);
  window.addEventListener("close", () => {
    window.removeEventListener("focus", onFocus);
  });

  {
    const profile = selectors.activeProfile(store.getState());
    if (profile !== undefined) {
      const savePath = profileSavePath(profile);
      store.dispatch(setSavegamePath(savePath));
    }
  }
}

function onLoadSaves(
  api: types.IExtensionApi,
  profileId: string,
): Promise<ISavegame[]> {
  const state = api.getState();
  const { profiles } = state.persistent;
  const currentProfile = selectors.activeProfile(state);

  if (profileId === undefined) {
    return Promise.resolve([]);
  }

  const gameProfiles = mygamesPath(currentProfile.gameId);
  const profilePath =
    profileId !== "__global"
      ? profileSavePath(profiles[profileId])
      : profileSavePath(currentProfile, true);
  const savesPath = path.resolve(gameProfiles, profilePath);

  const savegames: ISavegame[] = [];

  return refreshSavegames(
    savesPath,
    (save: ISavegame): void => {
      savegames.push(save);
    },
    false,
  ).then(() => savegames);
}

function onRestorePlugins(api: types.IExtensionApi, savegame: ISavegame) {
  const state = api.getState();
  const { dispatch } = api.store;
  const gameMode = selectors.activeGameId(state);
  const game = util.getGame(gameMode);
  const t = api.translate;
  const { discovered } = state.settings.gameMode;

  const discovery = util.getSafe(discovered, [gameMode], undefined);

  if (
    game === undefined ||
    discovery === undefined ||
    discovery.path === undefined
  ) {
    // How is this even possible ?
    util.showError(
      dispatch,
      "Failed to restore plugins",
      "Your active game is no longer discovered by Vortex; " +
        "please manually add your game, or run the discovery " +
        "scan on the games page.",
      { allowReport: true },
    );
    return;
  }

  const modPath = game.getModPaths(discovery.path)[""];

  const notificationId = "restore-plugins-id";
  util.showActivity(dispatch, "Restoring plugins", notificationId);

  restoreSavegamePlugins(api, modPath, savegame)
    .then(() => {
      util.showSuccess(dispatch, "Restoring plugins complete", notificationId);
    })
    .catch(MissingPluginsError, (err: MissingPluginsError) => {
      let restorePlugins = true;
      api
        .showDialog(
          "question",
          t("Restore plugins"),
          {
            message: t(
              "Some plugins are missing and can't be enabled.\n\n{{missingPlugins}}",
              {
                replace: {
                  missingPlugins: err.missingPlugins.join("\n"),
                },
              },
            ),
            options: {
              translated: true,
            },
          },
          [{ label: "Cancel" }, { label: "Continue" }],
        )
        .then((result: types.IDialogResult) => {
          restorePlugins = result.action === "Continue";
          if (restorePlugins) {
            api.events.emit("set-plugin-list", savegame.attributes.plugins);
            util.showSuccess(
              dispatch,
              "Restored plugins for savegame",
              notificationId,
            );
          } else {
            api.dismissNotification(notificationId);
          }
        });
    })
    .catch((err: Error) => {
      util.showError(dispatch, "Failed to restore plugins", err, {
        id: notificationId,
      });
    });
}

function onRemoveSavegames(
  api: types.IExtensionApi,
  profileId: string,
  savegameIds: string[],
) {
  const state = api.getState();
  const { dispatch } = api.store;

  const { profiles } = state.persistent;
  const currentProfile = selectors.activeProfile(state);

  // Use the profileId to resolve the correct sourcePath
  //  for the selected savegames.
  if (profileId !== "__global" && profileId !== undefined) {
    // User is attempting to delete a savegame from a specific profile;
    //  make sure the profile actually exists. This is more of a sanity
    //  check.
    //  https://github.com/Nexus-Mods/Vortex/issues/7291
    if (profiles[profileId] === undefined) {
      util.showError(
        dispatch,
        "Failed to delete savegame",
        "The profile attached to the savegame you're trying to remove no longer exists. " +
          "Please delete the file manually.",
        { allowReport: false },
      );
      return Promise.resolve();
    }
  }

  const gameProfiles = mygamesPath(currentProfile.gameId);
  const profilePath =
    profileId !== "__global"
      ? profileSavePath(profiles[profileId || currentProfile.id])
      : profileSavePath(currentProfile, true);

  const sourceSavePath = path.join(gameProfiles, profilePath);

  return Promise.map(savegameIds, (id) =>
    !!id
      ? Promise.map(saveFiles(currentProfile.gameId, id), (filePath) =>
          fs
            .removeAsync(path.join(sourceSavePath, filePath))
            .catch(util.UserCanceled, () => undefined)
            .catch((err) => {
              // We're not checking for 'ENOENT' at this point given that
              //  fs.removeAsync wrapper will resolve whenever these are
              //  encountered.
              if (err.code === "EPERM") {
                util.showError(
                  dispatch,
                  "Failed to delete savegame",
                  "The file is write protected.",
                  { allowReport: false },
                );
                return Promise.resolve();
              }
              return Promise.reject(err);
            })
            .then(() => {
              dispatch(removeSavegame(id));
            }),
        )
      : Promise.reject(new Error("invalid savegame id")),
  )
    .then(() => updateSaves(api.store, sourceSavePath))
    .catch((err) => {
      util.showError(
        dispatch,
        "Failed to delete savegame(s), this is probably a permission problem",
        err,
        { allowReport: false },
      );
    });
}

function onTransferSavegames(
  api: types.IExtensionApi,
  profileId: string,
  fileNames: string[],
  keepSource: boolean,
): Promise<{ errors: string[]; allowReport: boolean }> {
  const state = api.getState();
  const t = api.translate;
  const currentProfile = selectors.activeProfile(state);
  const { gameId } = currentProfile;
  const { profiles } = state.persistent;

  if (profileId !== "__global" && profiles[profileId] === undefined) {
    return api
      .showDialog(
        "error",
        "Profile doesn't exist",
        {
          text: "The profile you're trying to import from doesn't exist, did you recently delete it?",
          message: profileId,
        },
        [{ label: "Continue" }],
      )
      .then(() => Promise.reject(new util.ProcessCanceled("invalid profile")));
  }

  const sourceSavePath = path.resolve(
    mygamesPath(gameId),
    profileId !== "__global"
      ? profileSavePath(profiles[profileId])
      : profileSavePath(currentProfile, true),
  );

  const destSavePath = path.resolve(
    mygamesPath(gameId),
    profileSavePath(currentProfile),
  );

  let allowErrorReport = true;

  return fs
    .ensureDirAsync(destSavePath)
    .then(() =>
      transferSavegames(
        gameId,
        fileNames,
        sourceSavePath,
        destSavePath,
        keepSource,
      ),
    )
    .catch((err) => {
      allowErrorReport = ["EPERM", "ENOSPC"].includes(err.code);
      const logLevel = allowErrorReport ? "error" : "warn";
      log(logLevel, "Failed to create save game directory - ", err.code);

      return [
        t(
          "Unable to create save game directory: {{dest}}\\ (Please ensure you have " +
            "enough space and/or full write permissions to the destination folder)",
          {
            replace: { dest: destSavePath },
          },
        ),
      ];
    })
    .then((errors) => ({
      errors,
      allowReport: allowErrorReport,
    }));
}

function getInstalledPlugins(api: types.IExtensionApi): Promise<string[]> {
  const state = api.getState();
  const gameMode = selectors.activeGameId(state);
  const game = util.getGame(gameMode);
  const discovery = selectors.discoveryByGame(state, gameMode);

  if (game === undefined || discovery?.path === undefined) {
    return Promise.resolve([]);
  }

  return fs
    .readdirAsync(game.getModPaths(discovery.path)[""])
    .catch(() => Promise.resolve([]))
    .then((files: string[]) => {
      return files
        .filter((fileName: string) => {
          const ext = path.extname(fileName).toLowerCase();
          return [".esp", ".esm", ".esl"].indexOf(ext) !== -1;
        })
        .map((fileName) => fileName.toLowerCase());
    });
}

function init(context: IExtensionContextExt): boolean {
  initGameSupport(context.api);

  context.registerReducer(["session", "saves"], sessionReducer);
  context.registerReducer(["settings", "saves"], settingsReducer);

  context.registerAction(
    "savegames-icons",
    200,
    "transfer",
    {},
    "Transfer Save Games",
    () => {
      context.api.store.dispatch(showTransferDialog(true));
    },
  );

  context.registerAction(
    "savegames-icons",
    100,
    "refresh",
    {},
    "Refresh",
    () => {
      const profile = selectors.activeProfile(context.api.store.getState());
      update.runNow(undefined, profile.id, getSavesPath(profile));
    },
  );

  const onRefresh = () => {
    const profile = selectors.activeProfile(context.api.store.getState());
    update.schedule(undefined, profile.id, getSavesPath(profile));
  };
  const onLoadSavesProp = (profileId: string) =>
    onLoadSaves(context.api, profileId);
  const onRestorePluginsProp = (savegame: ISavegame) =>
    onRestorePlugins(context.api, savegame);
  const onRemoveSavegamesProp = (profileId: string, savegameIds: string[]) =>
    onRemoveSavegames(context.api, profileId, savegameIds);
  const onTransferSavegamesProp = (
    profileId: string,
    fileNames: string[],
    keepSource: boolean,
  ) => onTransferSavegames(context.api, profileId, fileNames, keepSource);
  const getInstalledPluginsProp = () => getInstalledPlugins(context.api);

  context.registerMainPage("savegame", "Save Games", SavegameList, {
    id: "gamebryo-savegames",
    hotkey: "A",
    group: "per-game",
    visible: () =>
      gameSupported(selectors.activeGameId(context.api.store.getState())),
    props: () => ({
      onRefresh,
      onLoadSaves: onLoadSavesProp,
      onRestorePlugins: onRestorePluginsProp,
      onRemoveSavegames: onRemoveSavegamesProp,
      onTransferSavegames: onTransferSavegamesProp,
      getInstalledPlugins: getInstalledPluginsProp,
    }),
  });

  const update = new util.Debouncer(
    genUpdateSavegameHandler(context.api),
    1000,
  );

  context.registerProfileFeature(
    "local_saves",
    "boolean",
    "savegame",
    "Save Games",
    "This profile has its own save games",
    () => gameSupported(selectors.activeGameId(context.api.store.getState())),
  );

  context.registerAction(
    "profile-actions",
    100,
    "open-ext",
    {},
    "Open Save Games",
    (instanceIds: string[]) => {
      openSavegamesDirectory(context.api, instanceIds[0]);
    },
    (instanceIds: string[]) => {
      const state: types.IState = context.api.store.getState();
      const profile = state.persistent.profiles[instanceIds[0]];
      return gameSupported(profile.gameId);
    },
  );

  context.registerAction(
    "savegames-icons",
    150,
    "open-ext",
    {},
    "Open Save Games",
    () => {
      openSavegamesDirectory(context.api);
    },
  );

  context.once(() => once(context, update));

  return true;
}

export default init;
