/**
 * Manages profiles
 *
 * API:
 *  registerProfileFile(gameId: string, filePath: string) - registers a file to be
 *    included in the profile so it gets stored in the profile and switched when the
 *    profile gets changed
 *
 * Commands (via window.api.profile.executeCommand):
 *   profile:create, profile:remove, profile:switch,
 *   profile:set-mod-enabled, profile:set-mods-enabled,
 *   profile:set-feature, profile:forget-mod, profile:set-activated
 */

import type * as Redux from "redux";

import PromiseBB from "bluebird";
import * as path from "path";
import { generate as shortid } from "shortid";

import type { IDialogResult } from "../../actions/notifications";
import type {
  IExtensionApi,
  IExtensionContext,
  ThunkStore,
} from "../../types/IExtensionContext";
import type { IGameStored, IState } from "../../types/IState";
import type { IExtension, IRegisteredExtension } from "../../types/extensions";
import type { IProfile } from "./types/IProfile";
import type { IProfileFeature } from "./types/IProfileFeature";

import { addNotification, showDialog } from "../../actions/notifications";
import {
  clearUIBlocker,
  setUIBlocker,
} from "../../actions/session";
import { relaunch } from "../../util/commandLine";
import {
  ProcessCanceled,
  ServiceTemporarilyUnavailable,
  TemporaryError,
  UserCanceled,
} from "../../util/CustomErrors";
import * as fs from "../../util/fs";
import getVortexPath from "../../util/getVortexPath";
import { log } from "../../util/log";
import { showError } from "../../util/message";
import {
  discoveryByGame,
  gameById,
  installPathForGame,
} from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";
import { truthy } from "../../util/util";
import { readExtensions } from "../extension_manager/util";
import { getGame } from "../gamemode_management/util/getGame";
import { ensureStagingDirectory } from "../mod_management/stagingDirectory";
import { purgeMods } from "../mod_management/util/deploy";
import { NoDeployment } from "../mod_management/util/exceptions";
import {
  setCurrentProfile,
} from "./actions/settings";
import { profilesReducer } from "./reducers/profiles";
import { settingsReducer } from "./reducers/settings";
import transferSetupReducer from "./reducers/transferSetup";
import {
  activeGameId,
  activeProfile,
  profileById,
} from "./selectors";
import { syncFromProfile, syncToProfile } from "./sync";
import { CorruptActiveProfile } from "./types/Errors";
import Connector from "./views/Connector";
import ProfileView from "./views/ProfileView";
import TransferDialog from "./views/TransferDialog";
import { getErrorMessageOrDefault } from "../../shared/errors";

const profileFiles: {
  [gameId: string]: Array<string | (() => PromiseLike<string[]>)>;
} = {};

const profileFeatures: IProfileFeature[] = [];

function profilePath(profile: IProfile): string {
  return path.join(
    getVortexPath("userData"),
    profile.gameId,
    "profiles",
    profile.id,
  );
}

function checkProfile(
  store: Redux.Store<any>,
  currentProfile: IProfile,
): PromiseBB<void> {
  return fs.ensureDirAsync(profilePath(currentProfile));
}


function refreshProfile(
  store: Redux.Store<any>,
  profile: IProfile,
  direction: "import" | "export",
): PromiseBB<void> {
  log("debug", "refresh profile", { profile, direction });
  if (profile === undefined || profile?.pendingRemove === true) {
    return PromiseBB.resolve();
  }
  if (profile.gameId === undefined || profile.id === undefined) {
    return PromiseBB.reject(new CorruptActiveProfile(profile));
  }
  return checkProfile(store, profile)
    .then(() => profilePath(profile))
    .then((currentProfilePath: string) => {
      // if this is the first sync, we assume the files on disk belong
      // to the profile that was last active in Vortex. This could only be
      // false if the profile was somehow changed before without a
      // syncFromProfile happening. Of course if the profile was never
      // loaded then it has no copies of the files but that if fine.
      const gameId = profile.gameId;
      if (profileFiles[gameId] === undefined) {
        return PromiseBB.resolve();
      }
      return PromiseBB.all(
        profileFiles[gameId].map((iter) => {
          return typeof iter === "string" ? PromiseBB.resolve([iter]) : iter();
        }),
      )
        .then((fileLists) => [].concat(...fileLists))
        .then((filePaths) => {
          if (direction === "import") {
            return syncToProfile(
              currentProfilePath,
              filePaths,
              (error, detail, allowReport) =>
                showError(store.dispatch, error, detail, { allowReport }),
            );
          } else {
            return syncFromProfile(
              currentProfilePath,
              filePaths,
              (error, detail, allowReport) =>
                showError(store.dispatch, error, detail, { allowReport }),
            );
          }
        });
    })
    .catch((err: Error) => {
      // why are we catching here at all? shouldn't a failure here cancel the
      // entire operation?
      if (err instanceof UserCanceled) {
        return PromiseBB.reject(err);
      }
      showError(store.dispatch, "Failed to set profile", err);
    });
}

/**
 * activate the specified game (using the last active profile for that game).
 * Will ask the user if the game was never active (how would this happen?)
 *
 * @param {string} gameId
 */
function activateGame(
  store: ThunkStore<IState>,
  gameId: string,
): PromiseBB<void> {
  const state: IState = store.getState();
  const gamePath = getSafe(
    state,
    ["settings", "gameMode", "discovered", gameId, "path"],
    undefined,
  );
  if (gamePath === undefined) {
    store.dispatch(
      addNotification({
        type: "warning",
        title: "{{gameId}} not enabled",
        message: "Game no longer discovered",
        replace: {
          gameId,
        },
      }),
    );
    log("info", "unselecting profile because game no longer discovered", {
      gameId,
    });
    window.api.profile.executeCommand({ type: 'profile:switch', profileId: undefined });
    return PromiseBB.resolve();
  }

  log("info", "activating game", { gameId, gamePath });

  const profileId = getSafe(
    state,
    ["settings", "profiles", "lastActiveProfile", gameId],
    undefined,
  );
  const profile = getSafe(
    state,
    ["persistent", "profiles", profileId],
    undefined,
  );
  if (profileId === undefined || profile === undefined) {
    const profiles = getSafe(state, ["persistent", "profiles"], []);
    const gameProfiles: IProfile[] = Object.keys(profiles)
      .filter((id: string) => profiles[id].gameId === gameId)
      .map((id: string) => profiles[id]);
    return store
      .dispatch(
        showDialog(
          "question",
          "Choose profile",
          {
            text: "Please choose the profile to use with this game",
            choices: gameProfiles.map((iter: IProfile, idx: number) => ({
              id: iter.id,
              text: iter.name,
              value: idx === 0,
            })),
          },
          [{ label: "Activate" }],
        ),
      )
      .then((dialogResult: IDialogResult) => {
        if (dialogResult.action === "Activate") {
          const selectedId = Object.keys(dialogResult.input).find(
            (id: string) => dialogResult.input[id],
          );
          log("info", "user selected profile", { selectedId });
          window.api.profile.executeCommand({ type: 'profile:switch', profileId: selectedId });
        }
      });
  } else {
    log("info", "using last active profile", { profileId });
    // actually, we have to verify that game is still discovered, otherwise we can't
    // activate it
    const fbProfile = state.persistent.profiles?.[profileId];
    const discovery = state.settings.gameMode.discovered?.[fbProfile?.gameId];
    if (discovery?.path !== undefined) {
      window.api.profile.executeCommand({ type: 'profile:switch', profileId });
    } else {
      window.api.profile.executeCommand({ type: 'profile:switch', profileId: undefined });
    }
    return PromiseBB.resolve();
  }
}

function manageGameDiscovered(api: IExtensionApi, gameId: string) {
  const profileId = shortid();
  // initialize the staging directory.
  // It's not great that this is here, the code would better fit into mod_management
  // but I'm not entirely sure what could happen if it's not initialized right away.
  // Since the dir has to be tagged we can't just sprinkle "ensureDir" anywhere we want
  // to access it.
  return ensureStagingDirectory(api, undefined, gameId)
    .then(() => {
      log("info", "user managing game for the first time", { gameId });
      window.api.profile.executeCommand({
        type: 'profile:create',
        profile: {
          id: profileId,
          gameId,
          name: "Default",
          modState: {},
          lastActivated: undefined,
        },
      });
      window.api.profile.executeCommand({ type: 'profile:switch', profileId });
    })
    .catch((err) => {
      const instPath = installPathForGame(api.store.getState(), gameId);
      api.showErrorNotification(
        "The game location doesn't exist or isn't writeable",
        err,
        {
          allowReport: false,
          message: instPath,
        },
      );
    });
}

function manageGameUndiscovered(
  api: IExtensionApi,
  gameId: string,
): PromiseBB<void> {
  let state: IState = api.store.getState();
  const knownGames = state.session.gameMode.known;
  const gameStored = knownGames.find((game) => game.id === gameId);

  if (gameStored === undefined) {
    const extension = state.session.extensions.available.find(
      (ext) => ext?.gameId === gameId || ext.name === gameId,
    );
    if (extension === undefined) {
      throw new ProcessCanceled(`Invalid game id "${gameId}"`);
    }

    return api
      .showDialog(
        "question",
        "Game support not installed",
        {
          text:
            "Support for this game is provided through an extension. To use it you have to " +
            "download that extension and restart Vortex.",
        },
        [
          { label: "Cancel" },
          {
            label: "Download",
            action: () => {
              api.store.dispatch(
                setUIBlocker(
                  "installing-game",
                  "download",
                  "Installing Game, Vortex will restart upon completion.",
                  true,
                ),
              );

              api.ext
                .ensureLoggedIn()
                .then(() => api.emitAndAwait("install-extension", extension))
                .then((results: boolean[]) => {
                  if (results.includes(true)) {
                    relaunch(["--game", gameId]);
                  }
                })
                .finally(() => {
                  api.store.dispatch(clearUIBlocker("installing-game"));
                })
                .catch((err) => {
                  if (err instanceof UserCanceled) {
                    return PromiseBB.resolve();
                  }

                  const allowReport =
                    !(err instanceof ProcessCanceled) &&
                    !(err instanceof ServiceTemporarilyUnavailable);
                  api.showErrorNotification("Log-in failed", err, {
                    id: "failed-get-nexus-key",
                    allowReport,
                  });
                });
            },
          },
        ],
      )
      .then(() => PromiseBB.resolve());
  }

  return api
    .showDialog(
      "question",
      "Game not discovered",
      {
        text:
          '"{{gameName}}" hasn\'t been automatically discovered, you will have to set the game ' +
          "folder manually.",
        parameters: {
          gameName: gameStored.name,
        },
      },
      [{ label: "Continue" }],
    )
    .then(
      () =>
        new PromiseBB((resolve, reject) => {
          api.events.emit(
            "manually-set-game-location",
            gameId,
            (err: Error) => {
              if (err !== null) {
                return reject(err);
              }
              return resolve();
            },
          );
        }),
    )
    .then(() => {
      state = api.store.getState();

      const discovered = state.settings.gameMode.discovered[gameId];
      if (discovered?.path === undefined) {
        // this probably means the "manually set location" was canceled
        return PromiseBB.resolve();
      }

      return manageGameDiscovered(api, gameId);
    })
    .catch((err) => {
      if (!(err instanceof UserCanceled) && !(err instanceof ProcessCanceled)) {
        api.showErrorNotification("Failed to manage game", err);
      }
      return;
    });
}

function manageGame(api: IExtensionApi, gameId: string): PromiseBB<void> {
  const state: IState = api.store.getState();
  const discoveredGames = state.settings.gameMode?.discovered || {};
  const profiles = state.persistent.profiles || {};

  if (getSafe(discoveredGames, [gameId, "path"], undefined) !== undefined) {
    const profile = Object.values(profiles).find(
      (prof) => prof.gameId === gameId,
    );
    if (profile !== undefined) {
      return activateGame(api.store, gameId);
    } else {
      return manageGameDiscovered(api, gameId);
    }
  } else {
    return manageGameUndiscovered(api, gameId);
  }
}

function removeMod(
  api: IExtensionApi,
  gameId: string,
  modId: string,
): PromiseBB<void> {
  return new PromiseBB((resolve, reject) => {
    api.events.emit("remove-mod", gameId, modId, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function unmanageGame(
  api: IExtensionApi,
  gameId: string,
  gameName?: string,
): PromiseBB<void> {
  const state = api.getState();
  const game = getGame(gameId);
  const { mods, profiles } = state.persistent;
  const profileIds = Object.keys(profiles).filter(
    (profileId) => profiles[profileId]?.gameId === gameId,
  );

  api.events.emit("analytics-track-event", "Games", "Stop managing", gameId);

  let message: string;

  if (profileIds.length > 1 || profiles[profileIds[0]]?.name !== "Default") {
    message = profileIds.map((id) => profiles[id]?.name || id).join("\n");
  }

  return api
    .showDialog(
      "info",
      "Confirm Removal",
      {
        bbcode:
          "This will uninstall all mods managed by vortex and delete all profiles " +
          'for "{{gameName}}", ' +
          "potentially including associated savegames, ini files and everything else Vortex " +
          "stores per-profile." +
          "[br][/br][br][/br]" +
          "[style=dialog-danger-text]This is irreversible and we will not warn again, continue only if " +
          "you're sure this is what you want![/style]",
        message,
        parameters: {
          gameName: game?.name ?? gameName ?? api.translate("<Missing game>"),
        },
      },
      [{ label: "Cancel" }, { label: "Delete profiles" }],
    )
    .then((result) => {
      if (result.action === "Delete profiles") {
        return purgeMods(api, gameId, true)
          .then(() =>
            PromiseBB.map(Object.keys(mods[gameId] ?? {}), (modId) =>
              removeMod(api, gameId, modId),
            ),
          )
          .then(() =>
            PromiseBB.map(profileIds, (profileId) =>
              PromiseBB.resolve(
                window.api.profile.executeCommand({ type: 'profile:remove', profileId }),
              ),
            ),
          )
          .then(() => PromiseBB.resolve())
          .catch(UserCanceled, () => PromiseBB.resolve())
          .catch((err) => {
            const isSetupError =
              err instanceof NoDeployment || err instanceof TemporaryError;
            if (isSetupError) {
              api.showDialog(
                "error",
                "Failed to purge",
                {
                  text:
                    "Failed to purge mods deployed for this game. To ensure there are no " +
                    "leftovers before Vortex stops managing the game, please solve any " +
                    "setup problems for the game first.",
                },
                [{ label: "Close" }],
              );
              return;
            } else {
              api.showErrorNotification("Failed to stop managing game", err, {
                allowReport: !(err instanceof ProcessCanceled),
              });
            }
          });
      } else {
        return PromiseBB.resolve();
      }
    });
}

function addDescriptionFeature() {
  profileFeatures.push({
    id: "profile-description",
    type: "text",
    icon: "edit",
    label: "Description",
    description: "Describe your profile",
    supported: () => true,
    namespace: "default",
  });
}

function checkOverridden(api: IExtensionApi, gameId: string): PromiseBB<void> {
  const state = api.getState();
  const { disabled } = state.session.gameMode;

  if (disabled[gameId] === undefined) {
    return PromiseBB.resolve();
  }

  return api
    .showDialog(
      "question",
      "Game disabled",
      {
        text: "A different game extension is currently managing that game directory.",
        message: gameById(state, disabled[gameId]).name,
      },
      [{ label: "Cancel" }],
    )
    .then(() => PromiseBB.reject(new UserCanceled()));
}

function init(context: IExtensionContext): boolean {
  context.registerReducer(["persistent", "profiles"], profilesReducer);
  context.registerReducer(["settings", "profiles"], settingsReducer);
  context.registerReducer(["session", "profileTransfer"], transferSetupReducer);

  context.registerMainPage("profile", "Profiles", ProfileView, {
    hotkey: "P",
    group: "global",
    visible: () =>
      activeGameId(context.api.store.getState()) !== undefined &&
      context.api.store.getState().settings.interface.profilesVisible,
    props: () => ({ features: profileFeatures }),
  });

  context.registerAction(
    "game-unmanaged-buttons",
    50,
    "activate",
    {
      noCollapse: true,
    },
    "Manage",
    (instanceIds: string[]) => {
      const gameId = instanceIds[0];

      context.api.events.emit(
        "analytics-track-event",
        "Games",
        "Start managing",
        gameId,
      );

      context.api
        .emitAndAwait("discover-game", gameId)
        .then(() => checkOverridden(context.api, gameId))
        .then(() => {
          const state = context.api.getState();
          const manageFunc =
            state.settings.gameMode.discovered[gameId]?.path !== undefined
              ? manageGameDiscovered
              : manageGameUndiscovered;

          manageFunc(context.api, gameId);
        })
        .catch((err) => {
          if (!(err instanceof UserCanceled)) {
            context.api.showErrorNotification("Failed to manage game", err);
          }
        });
    },
  );

  context.registerAction(
    "game-managed-buttons",
    50,
    "activate",
    {
      noCollapse: true,
    },
    "Activate",
    (instanceIds: string[]) => {
      const gameId = instanceIds[0];
      const state = context.api.getState();

      let gameVersion = "";
      let extensionVersion = "";
      let gameProfileCount = 1;

      if (gameId) {
        const game = getGame(gameId);
        extensionVersion = game.version;
        game
          .getInstalledVersion(discoveryByGame(state, gameId))
          .then((value) => {
            gameVersion = value;
          });
        gameProfileCount = Object.values(state.persistent.profiles).filter(
          (profile) => {
            return profile.gameId === gameId;
          },
        ).length;
      }

      const profileData = {
        gameId: gameId,
        gameVersion: gameVersion,
        extensionVersion: extensionVersion,
        gameProfileCount: gameProfileCount,
      };

      log("info", "activate profile", profileData);

      context.api.events.emit(
        "analytics-track-event",
        "Games",
        "Activate",
        gameId,
        profileData,
      );

      checkOverridden(context.api, gameId)
        .then(() => {
          activateGame(context.api.store, gameId);
        })
        .catch((err) => {
          if (!(err instanceof UserCanceled)) {
            context.api.showErrorNotification("Failed to activate game", err);
          }
        });
    },
    (instanceIds: string[]) =>
      activeGameId(context.api.getState()) !== instanceIds[0],
  );

  context.registerProfileFile = (
    gameId: string,
    filePath: string | (() => PromiseLike<string[]>),
  ) => {
    if (profileFiles[gameId] === undefined) {
      profileFiles[gameId] = [];
    }
    profileFiles[gameId].push(filePath);
  };

  context.registerAction(
    "game-managed-buttons",
    150,
    "delete",
    {},
    context.api.translate("Stop Managing"),
    (instanceIds: string[]) => {
      unmanageGame(context.api, instanceIds[0]);
    },
  );

  context.registerProfileFeature = (
    featureId: string,
    type: string,
    icon: string,
    label: string,
    description: string,
    supported: () => boolean,
    extPath?: string,
    extInfo?: Partial<IRegisteredExtension>,
  ) => {
    profileFeatures.push({
      id: featureId,
      type,
      icon,
      label,
      description,
      supported,
      namespace: extInfo?.namespace,
    });
  };

  context.registerActionCheck(
    "SET_NEXT_PROFILE",
    (state: IState, action: any) => {
      const { profileId } = action.payload;
      context.api.dismissAllNotifications();
      if (profileId === undefined) {
        // resetting must always work
        return undefined;
      }

      const profile = state.persistent.profiles[profileId];
      if (profile === undefined) {
        return "Tried to activate unknown profile";
      }

      if (
        getSafe(
          state,
          ["settings", "gameMode", "discovered", profile.gameId, "path"],
          undefined,
        ) === undefined
      ) {
        return "Can't enable profile because game wasn't discovered";
      }

      return undefined;
    },
  );

  context.registerAPI(
    "unmanageGame",
    (gameId: string, gameName?: string) =>
      unmanageGame(context.api, gameId, gameName),
    {},
  );

  // ensure the current profile is always set to a valid value on startup and
  // when changing the game mode
  context.once(() => {
    const store = context.api.store;

    addDescriptionFeature();

    context.api.events.on("activate-game", (gameId: string) => {
      activateGame(store, gameId);
    });

    let first = true;
    context.api.onStateChange(
      ["session", "gameMode", "known"],
      (prev: IGameStored[], current: IGameStored[]) => {
        // known games should only be set once but better safe than sorry
        if (!first) {
          return;
        }
        first = false;
        const state: IState = store.getState();
        const { commandLine } = state.session.base;
        if (commandLine.profile !== undefined) {
          const profile: IProfile = getSafe(
            state,
            ["persistent", "profiles", commandLine.profile],
            undefined,
          );

          if (profile !== undefined) {
            window.api.profile.executeCommand({ type: 'profile:switch', profileId: profile.id });
          } else {
            log(
              "warn",
              "profile cmdline argument detected - but profile is missing",
              commandLine.profile,
            );
          }
        } else if (commandLine.game !== undefined) {
          // the game specified on the command line may be a game id or an extension
          // name, because at the time we download an extension we don't actually know
          // the game id yet.

          readExtensions(false).then(
            (extensions: { [extId: string]: IExtension }) => {
              const extPathLookup = Object.values(extensions).reduce(
                (prevExt, ext) => {
                  if (ext.path !== undefined) {
                    prevExt[ext.path] = ext.name;
                  }
                  return prevExt;
                },
                {},
              );

              const game = current.find(
                (iter) =>
                  iter.id === commandLine.game ||
                  extPathLookup[iter.extensionPath] === commandLine.game,
              );

              if (game !== undefined) {
                manageGame(context.api, game.id);
              } else {
                log("warn", "game specified on command line not found", {
                  game: commandLine.game,
                });
              }
            },
          );
        }
      },
    );

    {
      const state: IState = store.getState();

      const initProfile = activeProfile(state);
      refreshProfile(store, initProfile, "import")
        .then(() => {
          const { commandLine } = state.session.base;
          if (
            initProfile !== undefined &&
            commandLine?.profile === undefined &&
            commandLine?.game === undefined
          ) {
            context.api.events.emit("profile-did-change", initProfile.id);
          }
          return null;
        })
        .catch((err: Error) => {
          if (!(err instanceof UserCanceled)) {
            const allowReport = !(err instanceof CorruptActiveProfile);
            showError(store.dispatch, "Failed to set profile", err, {
              allowReport,
            });
          }
          store.dispatch(setCurrentProfile(undefined, undefined));
          window.api.profile.executeCommand({ type: 'profile:switch', profileId: undefined });
        });

      const { activeProfileId, nextProfileId } = state.settings.profiles;
      if (nextProfileId !== activeProfileId) {
        log("warn", "started with a profile change in progress");

        // ensure the new profile is valid and the corresponding game is
        // discovered
        if (
          truthy(activeProfileId) &&
          state.persistent.profiles[activeProfileId] !== undefined
        ) {
          const profile = state.persistent.profiles[activeProfileId];
          const discovery = discoveryByGame(state, profile.gameId);
          if (discovery?.path !== undefined) {
            window.api.profile.executeCommand({ type: 'profile:switch', profileId: activeProfileId });
          } else {
            window.api.profile.executeCommand({ type: 'profile:switch', profileId: undefined });
          }
        } else {
          window.api.profile.executeCommand({ type: 'profile:switch', profileId: undefined });
        }
      }

      // it's important we stop managing a game if it's no longer discovered
      // because that can cause problems all over the application
      if (truthy(activeProfileId)) {
        const profile = state.persistent.profiles[activeProfileId];
        if (profile === undefined) {
          return;
        }
        const discovery = state.settings.gameMode.discovered[profile.gameId];
        if (discovery === undefined || discovery.path === undefined) {
          log("info", "active game no longer discovered, deactivate");
          window.api.profile.executeCommand({ type: 'profile:switch', profileId: undefined });
        }
      }
    }
  });

  context.registerDialog("profile-transfer-connector", Connector);
  context.registerDialog("transfer-dialog-settings", TransferDialog);

  return true;
}

export default init;
