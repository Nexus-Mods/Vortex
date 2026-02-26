/**
 * Manages profiles
 *
 * New API:
 *  registerProfileFile(gameId: string, filePath: string) - registers a file to be
 *    included in the profile so it gets stored in the profile and switched when the
 *    profile gets changed
 * State:
 *   settings.profiles.activeProfileId: string - currently active profile id
 *   persistent.profiles: { [gameId: string]: { [profileId: string]: IProfile } } -
 *      dictionary of all profiles
 * Actions:
 *   setProfile(gameId: string, profile: IProfile) - adds a new profile or changes an existing one
 *   setNextProfile(gameId: string, profileId: string) - activates a profile
 *   setModEnabled(gameId: string, profileId: string, modId: string, enabled: boolean) -
 *      enables or disables a mod in the current profile
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
import type {
  IExtension,
  IExtensionDownloadInfo,
  IRegisteredExtension,
} from "../../types/extensions";
import type { IProfile } from "./types/IProfile";
import type { IProfileFeature } from "./types/IProfileFeature";

import { addNotification, showDialog } from "../../actions/notifications";
import {
  clearUIBlocker,
  setProgress,
  setUIBlocker,
} from "../../actions/session";
import { relaunch } from "../../util/commandLine";
import {
  ProcessCanceled,
  ServiceTemporarilyUnavailable,
  SetupError,
  TemporaryError,
  UserCanceled,
} from "../../util/CustomErrors";
import * as fs from "../../util/fs";
import getVortexPath from "../../util/getVortexPath";
import { log } from "../../util/log";
import { showError } from "../../util/message";
import onceCB from "../../util/onceCB";
import {
  discoveryByGame,
  gameById,
  installPathForGame,
  needToDeployForGame,
} from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";
import { batchDispatch, truthy } from "../../util/util";

import { readExtensions } from "../extension_manager/util";
import {
  getGame,
  getGameStubDownloadInfo,
} from "../gamemode_management/util/getGame";
import { ensureStagingDirectory } from "../mod_management/stagingDirectory";
import { purgeMods } from "../mod_management/util/deploy";
import { NoDeployment } from "../mod_management/util/exceptions";
import {
  forgetMod,
  removeProfile,
  setProfile,
  setProfileActivated,
  willRemoveProfile,
} from "./actions/profiles";
import {
  clearLastActiveProfile,
  setCurrentProfile,
  setNextProfile,
} from "./actions/settings";
import { STUCK_TIMEOUT } from "./constants";
import { profilesReducer } from "./reducers/profiles";
import { settingsReducer } from "./reducers/settings";
import transferSetupReducer from "./reducers/transferSetup";
import {
  activeGameId,
  activeProfile,
  lastActiveProfileForGame,
  profileById,
} from "./selectors";
import { syncFromProfile, syncToProfile } from "./sync";
import { CorruptActiveProfile } from "./types/Errors";
import Connector from "./views/Connector";
import ProfileView from "./views/ProfileView";
import TransferDialog from "./views/TransferDialog";
import { getErrorMessageOrDefault } from "../../../shared/errors";

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

function sanitizeProfile(store: Redux.Store<any>, profile: IProfile): void {
  const state: IState = store.getState();
  const batched = [];
  Object.keys(profile.modState || {}).forEach((modId) => {
    if (
      getSafe(state.persistent.mods, [profile.gameId, modId], undefined) ===
      undefined
    ) {
      log("debug", "removing info of missing mod from profile", {
        profile: profile.id,
        game: profile.gameId,
        modId,
      });
      batched.push(forgetMod(profile.id, modId));
    }
  });
  if (batched.length > 0) {
    batchDispatch(store, batched);
  }
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
    store.dispatch(setNextProfile(undefined));
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
          store.dispatch(setNextProfile(selectedId));
        }
      });
  } else {
    log("info", "using last active profile", { profileId });
    // actually, we have to verify that game is still discovered, otherwise we can't
    // activate it
    const fbProfile = state.persistent.profiles?.[profileId];
    const discovery = state.settings.gameMode.discovered?.[fbProfile?.gameId];
    if (discovery?.path !== undefined) {
      store.dispatch(setNextProfile(profileId));
    } else {
      store.dispatch(setNextProfile(undefined));
    }
    return PromiseBB.resolve();
  }
}

function deploy(api: IExtensionApi, profileId: string): PromiseBB<void> {
  const state: IState = api.store.getState();
  if (
    profileId === undefined ||
    state.persistent.profiles[profileId] === undefined
  ) {
    return PromiseBB.resolve();
  }

  const profile = profileById(state, profileId);
  if (
    profileId === lastActiveProfileForGame(state, profile.gameId) &&
    !needToDeployForGame(state, profile.gameId)
  ) {
    return PromiseBB.resolve();
  }

  const gameDiscovery = getSafe(
    state,
    ["settings", "gameMode", "discovered", profile.gameId],
    undefined,
  );
  if (gameDiscovery?.path === undefined) {
    // can't deploy a game that hasn't been discovered
    return PromiseBB.resolve();
  }

  let lastProgress: number = Date.now();

  const watchdog = setInterval(() => {
    if (Date.now() - lastProgress > STUCK_TIMEOUT) {
      api.store.dispatch(
        setProgress(
          "profile",
          "deploying",
          api.translate("Stuck? Please check your vortex.log file."),
          0,
        ),
      );
    }
  }, 1000);

  return new PromiseBB((resolve, reject) => {
    api.events.emit(
      "deploy-mods",
      onceCB((err: Error) => {
        clearInterval(watchdog);
        if (err === null) {
          resolve();
        } else {
          reject(err);
        }
      }),
      profileId,
      (text: string, percent: number) => {
        lastProgress = Date.now();
        api.store.dispatch(setProgress("profile", "deploying", text, percent));
      },
    );
  });
}

/* generates a profile change handler.
 * that is: it reacts to the "next profile" being changed, which triggers the
 * "active profile" being updated. "onFinishProfileSwitch" registers a callback
 * which will signal when the active profile has been updated, only then will the
 * next profile switch be allowed.
 */
function genOnProfileChange(
  api: IExtensionApi,
  onFinishProfileSwitch: (callback: () => void) => void,
) {
  let finishProfileSwitchPromise: PromiseBB<void> = PromiseBB.resolve();
  const { store } = api;

  let cancelPromise: () => void;

  const invokeCancel = () => {
    if (cancelPromise !== undefined) {
      onFinishProfileSwitch(undefined);
      cancelPromise();
      cancelPromise = undefined;
    }
  };

  const cancelSwitch = () => {
    invokeCancel();
    store.dispatch(setCurrentProfile(undefined, undefined));
    store.dispatch(setNextProfile(undefined));
  };

  const confirmProfile = (gameId: string, current: string) => {
    store.dispatch(setCurrentProfile(gameId, current));
    if (current !== undefined) {
      store.dispatch(setProfileActivated(current));
    }
    const confirmPromise = cancelPromise;
    setTimeout(() => {
      if (confirmPromise === cancelPromise && cancelPromise !== undefined) {
        log("warn", "active profile switch didn't get confirmed?");
        invokeCancel();
      }
    }, 2000);
  };

  return (prev: string, current: string) => {
    log("debug", "profile change", { from: prev, to: current });
    finishProfileSwitchPromise
      .then(() => {
        const state: IState = store.getState();
        if (state.settings.profiles.nextProfileId !== current) {
          // cancel if there was another profile switch while we waited
          return null;
        }

        if (state.settings.profiles.activeProfileId === current) {
          // also do nothing if we're actually resetting the nextprofile
          return null;
        }

        const profile = state.persistent.profiles[current];
        if (profile === undefined && current !== undefined) {
          return PromiseBB.reject(new Error("Tried to set invalid profile"));
        }

        if (profile !== undefined) {
          const { gameId } = profile;
          const game = getGame(gameId);
          if (game === undefined) {
            showError(
              store.dispatch,
              "Game no longer supported, please install the game extension",
              undefined,
              { message: profile.gameId, allowReport: false },
            );
            return PromiseBB.reject(
              new ProcessCanceled("Game no longer supported"),
            );
          }

          const discovery = state.settings.gameMode.discovered[profile.gameId];
          if (discovery?.path === undefined) {
            showError(
              store.dispatch,
              "Game is no longer discoverable, please go to the games page and scan for, or " +
                "manually select the game folder.",
              profile.gameId,
              { allowReport: false },
            );
            return PromiseBB.reject(
              new ProcessCanceled("Game no longer discovered"),
            );
          }
        }

        finishProfileSwitchPromise = new PromiseBB<void>((resolve, reject) => {
          cancelPromise = resolve;
          onFinishProfileSwitch(() => {
            cancelPromise = undefined;
            resolve();
          });
        }).catch((err) => {
          showError(store.dispatch, "Profile switch failed", err);
          return PromiseBB.resolve();
        });

        // IMPORTANT: After this point we expect an external signal to tell
        //   us when the active profile has been updated, otherwise we will not
        //   allow the next profile switch
        //   any error handler *has* to cancel this confirmation!

        let queue: PromiseBB<void> = PromiseBB.resolve();
        // emit an event notifying about the impending profile change.
        // every listener can return a cb returning a promise which will be
        // awaited before continuing.
        // It would be fun if we could cancel the profile change if one of
        // these promises is rejected but that would only work if we could roll back
        // changes that happened.
        const enqueue = (cb: () => PromiseBB<void>) => {
          queue = queue.then(cb).catch((err) => {
            const message = getErrorMessageOrDefault(err);
            log("error", "error in profile-will-change handler", message);
            PromiseBB.resolve();
          });
        };

        const oldProfile = state.persistent.profiles[prev];
        // changes to profile files are only saved back to the profile at this point
        queue = queue.then(() => refreshProfile(store, oldProfile, "import"));

        api.events.emit("profile-will-change", current, enqueue);

        if (current === undefined) {
          log("info", "switched to no profile");
          confirmProfile(undefined, undefined);
          return queue;
        }

        sanitizeProfile(store, profile);

        return (
          queue
            .then(() => {
              log("debug", "starting refresh profile export");
              return refreshProfile(store, profile, "export");
            })
            // ensure the old profile is synchronised before we switch, otherwise me might
            // revert some changes
            .then(() => {
              log("info", "will deploy previously active profile", prev);
              return deploy(api, prev);
            })
            .then(() => {
              log("info", "did deploy previously active profile", prev);
              log("info", "will deploy next active profile", current);
              return deploy(api, current);
            })
            .then(() => {
              log("info", "did deploy next active profile", current);
              const prof = profileById(api.store.getState() as IState, current);
              if (prof === undefined) {
                return PromiseBB.reject(
                  new ProcessCanceled(
                    "Profile was deleted during deployment. " +
                      "Why would you do something like that???",
                  ),
                );
              }

              api.store.dispatch(
                setProgress("profile", "deploying", undefined, undefined),
              );
              const gameId = profile !== undefined ? profile.gameId : undefined;
              log("info", "switched to profile", { gameId, current });
              confirmProfile(gameId, current);
              return null;
            })
        );
      })
      .catch((err) => {
        cancelSwitch();
        return PromiseBB.reject(err);
      })
      .catch(ProcessCanceled, (err) => {
        showError(store.dispatch, "Failed to set profile", err.message, {
          allowReport: false,
        });
      })
      .catch(SetupError, (err) => {
        showError(store.dispatch, "Failed to set profile", err.message, {
          allowReport: false,
        });
      })
      .catch(CorruptActiveProfile, (err) => {
        // AFAICT the only way for this error to pop up is when upgrading from
        //  an ancient version of Vortex which probably had a bug in it which we
        //  fixed a long time ago. Corrupt profiles are automatically removed by
        //  our verifiers and the user will just have to create a new profile for
        //  their game - not much we can do to help him with that.
        showError(store.dispatch, "Failed to set profile", err, {
          allowReport: false,
        });
      })
      .catch(UserCanceled, () => null)
      .catch((err) => {
        showError(store.dispatch, "Failed to set profile", err);
      });
  };
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
      api.store.dispatch(
        setProfile({
          id: profileId,
          gameId,
          name: "Default",
          modState: {},
          lastActivated: undefined,
        }),
      );
      api.store.dispatch(setNextProfile(profileId));
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
    const stubDownloadInfo = getGameStubDownloadInfo(gameId);
    let extension: IExtensionDownloadInfo;
    if (stubDownloadInfo !== undefined) {
      if (
        stubDownloadInfo.modId !== undefined &&
        stubDownloadInfo.fileId === undefined
      ) {
        const manifestEntry = state.session.extensions.available.find(
          (ext) => ext.modId === stubDownloadInfo.modId,
        );
        if (manifestEntry !== undefined) {
          stubDownloadInfo.fileId = manifestEntry.fileId;
        }
      }
      extension = stubDownloadInfo;
    } else {
      extension = state.session.extensions.available.find(
        (ext) => ext?.gameId === gameId || ext.name === gameId,
      );
    }
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

function removeProfileImpl(api: IExtensionApi, profileId: string) {
  const { store } = api;
  const state = api.getState();
  const { profiles } = state.persistent;
  log("info", "user removing profile", { id: profileId });

  if (profiles[profileId] === undefined) {
    // nothing to do
    return PromiseBB.resolve();
  }

  const currentProfile = activeProfile(state);

  store.dispatch(willRemoveProfile(profileId));
  if (profileId === currentProfile?.id) {
    store.dispatch(setNextProfile(undefined));
  }

  return fs
    .removeAsync(profilePath(profiles[profileId]))
    .catch((err) =>
      err.code === "ENOENT" ? PromiseBB.resolve() : PromiseBB.reject(err),
    )
    .then(() => {
      const gameMode = profiles[profileId].gameId;
      const lastProfileId = lastActiveProfileForGame(state, gameMode);
      if (profileId === lastProfileId) {
        store.dispatch(clearLastActiveProfile(gameMode));
      }
      store.dispatch(removeProfile(profileId));
    })
    .catch((err) => {
      api.showErrorNotification("Failed to remove profile", err, {
        allowReport: err.code !== "EPERM",
      });
    });
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
          gameName:
            game?.name ?? gameName ?? String(api.translate("<Missing game>")),
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
              removeProfileImpl(api, profileId),
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
    isClassicOnly: true,
    visible: () =>
      activeGameId(context.api.store.getState()) !== undefined &&
      context.api.store.getState().settings.interface.profilesVisible,
    props: () => ({ features: profileFeatures }),
  });

  context.registerMainPage("profile", "Profiles", ProfileView, {
    priority: 35,
    id: "game-profiles",
    hotkey: "P",
    group: "per-game",
    isModernOnly: true,
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

    // promise used to ensure a new profile switch can't be started before the last one
    // is complete
    let finishProfileSwitch: () => void;

    context.api.onStateChange(
      ["settings", "profiles", "nextProfileId"],
      genOnProfileChange(
        context.api,
        (callback: () => void) => (finishProfileSwitch = callback),
      ),
    );

    context.api.onStateChange(
      ["settings", "profiles", "activeProfileId"],
      (prev: string, current: string) => {
        context.api.events.emit("profile-did-change", current);
        if (finishProfileSwitch !== undefined) {
          finishProfileSwitch();
        }
      },
    );

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
            context.api.store.dispatch(setNextProfile(profile.id));
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

    context.api.onStateChange(
      ["persistent", "profiles"],
      (
        prev: { [profileId: string]: IProfile },
        current: { [profileId: string]: IProfile },
      ) => {
        Object.keys(current).forEach((profileId) => {
          if (prev[profileId] === current[profileId]) {
            return;
          }

          const profile = current[profileId];

          const prevState = getSafe(prev, [profileId, "modState"], {});
          const currentState = getSafe(current, [profileId, "modState"], {});

          if (prevState !== currentState) {
            const mods = context.api.getState().persistent.mods[profile.gameId];
            Object.keys(currentState).forEach((modId) => {
              const isEnabled = getSafe(
                currentState,
                [modId, "enabled"],
                false,
              );
              const wasEnabled = getSafe(prevState, [modId, "enabled"], false);

              if (isEnabled !== wasEnabled && mods[modId] !== undefined) {
                context.api.events.emit(
                  isEnabled ? "mod-enabled" : "mod-disabled",
                  profileId,
                  modId,
                );
              }
            });
          }
        });
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
          store.dispatch(setNextProfile(undefined));
          if (finishProfileSwitch !== undefined) {
            finishProfileSwitch();
          }
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
            store.dispatch(setNextProfile(activeProfileId));
          } else {
            store.dispatch(setNextProfile(undefined));
          }
        } else {
          store.dispatch(setNextProfile(undefined));
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
          store.dispatch(setNextProfile(undefined));
        }
      }
    }
  });

  context.registerDialog("profile-transfer-connector", Connector);
  context.registerDialog("transfer-dialog-settings", TransferDialog);

  return true;
}

export default init;
