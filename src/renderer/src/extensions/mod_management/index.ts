import type * as Redux from "redux";

import { getErrorCode, unknownToError } from "@vortex/shared";
import * as _ from "lodash";
import * as path from "path";
import React from "react";
import shortid from "shortid";

import type {
  IExtensionApi,
  IExtensionContext,
  IInstallResult,
  MergeFunc,
  MergeTest,
} from "../../types/IExtensionContext";
import type { IGame } from "../../types/IGame";
import type { INotification } from "../../types/INotification";
import type { IDiscoveryResult, IState } from "../../types/IState";
import type { ITableAttribute } from "../../types/ITableAttribute";
import type { ITestResult } from "../../types/ITestResult";
import type {
  IProfile,
  IProfileMod,
} from "../profile_management/types/IProfile";
import type {
  IDeployedFile,
  IDeploymentMethod,
  IUnavailableReason,
} from "./types/IDeploymentMethod";
import type { IDeployOptions } from "./types/IDeployOptions";
import type { IFileMerge } from "./types/IFileMerge";
import type { IInstallOptions } from "./types/IInstallOptions";
import type { IMod, IModReference } from "./types/IMod";
import type { InstallFunc } from "./types/InstallFunc";
import type { IRemoveModOptions } from "./types/IRemoveModOptions";
import type { IResolvedMerger } from "./types/IResolvedMerger";
import type { TestSupported } from "./types/TestSupported";
import type {
  IDuplicatesMap,
  IRemoveDuplicateMap,
} from "./views/DuplicatesDialog";

import { setDialogVisible } from "../../actions";
import {
  dismissNotification,
  type ICheckbox,
  updateNotification,
} from "../../actions/notifications";
import {
  setSettingsPage,
  startActivity,
  stopActivity,
} from "../../actions/session";
import LazyComponent from "../../controls/LazyComponent";
import { log } from "../../logging";
import ReduxProp from "../../ReduxProp";
import { nxmMod } from "../../ui/icon-paths";
import { opn } from "../../util/api";
import {
  ProcessCanceled,
  TemporaryError,
  UserCanceled,
} from "../../util/CustomErrors";
import Debouncer from "../../util/Debouncer";
import { withTrackedActivity } from "../../util/errorHandling";
import * as fs from "../../util/fs";
import getNormalizeFunc from "../../util/getNormalizeFunc";
import getVortexPath from "../../util/getVortexPath";
import { laterT, type TFunction } from "../../util/i18n";
import { showError } from "../../util/message";
import onceCB from "../../util/onceCB";
import {
  activeGameId,
  activeProfile,
  currentGameDiscovery,
  downloadPathForGame,
  knownGames,
  installPath,
  installPathForGame,
  modPathsForGame,
  profileById,
} from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";
import {
  batchDispatch,
  isChildPath,
  truthy,
  wrapExtCBAsync,
} from "../../util/util";
import { waitForCondition } from "../../util/waitForCondition";
import { setDownloadModInfo } from "../download_management/actions/state";
import { getGame } from "../gamemode_management/util/getGame";
import { getModType } from "../gamemode_management/util/modTypeExtensions";
import { convertGameIdReverse } from "../nexus_integration/util/convertGameId";
import {
  type IEnableOptions,
  setModEnabled,
  forgetMod,
} from "../profile_management/actions/profiles";
import { enabledModCountForProfile } from "../profile_management/selectors";
import { setAutoDeployment } from "../settings_interface/actions/automation";
import { setDeploymentNecessary } from "./actions/deployment";
import { cacheModReference, removeMod, setModAttribute } from "./actions/mods";
import { setDeploymentProblem } from "./actions/session";
import { setTransferMods } from "./actions/transactions";
import {
  onAddMod,
  onGameModeActivated,
  onModsChanged,
  onPathsChanged,
  onRemoveMod,
  onRemoveMods,
  onStartInstallDownload,
} from "./eventHandlers";
import InstallManager from "./InstallManager";
import deployMods from "./modActivation";
import mergeMods, { MERGED_PATH } from "./modMerging";
import preStartDeployHook from "./preStartDeployHook";
import { deploymentReducer } from "./reducers/deployment";
import { modsReducer } from "./reducers/mods";
import { sessionReducer } from "./reducers/session";
import { settingsReducer } from "./reducers/settings";
import { transactionsReducer } from "./reducers/transactions";
import getText from "./texts";
import {
  fallbackPurge,
  loadActivation,
  saveActivation,
  withActivationLock,
} from "./util/activationStore";
import allTypesSupported from "./util/allTypesSupported";
import * as basicInstaller from "./util/basicInstaller";
import BlacklistSet from "./util/BlacklistSet";
import { findModByRef } from "./util/dependencies";
import { genSubDirFunc, purgeMods, purgeModsInPath } from "./util/deploy";
import {
  getAllActivators,
  getCurrentActivator,
  getSelectedActivator,
  getSupportedActivators,
  registerDeploymentMethod,
} from "./util/deploymentMethods";
import { NoDeployment } from "./util/exceptions";
import extendApi from "./util/extendAPI";
import { dealWithExternalChanges } from "./util/externalChanges";
import { registerAttributeExtractor } from "./util/filterModInfo";
import ModHistory from "./util/ModHistory";
import renderModName from "./util/modName";
import { getModSources, registerModSource } from "./util/modSource";
import sortMods, { CycleError } from "./util/sort";
import { setResolvedCB } from "./util/testModReference";
import ActivationButton from "./views/ActivationButton";
import DeactivationButton from "./views/DeactivationButton";
import {} from "./views/ExternalChangeDialog";
import {} from "./views/FixDeploymentDialog";
import {} from "./views/ModList";
import {} from "./views/Settings";
import URLInput from "./views/URLInput";
import Workarounds from "./views/Workarounds";

interface IAppContext {
  isProfileChanging: boolean;
}

const appContext: IAppContext = {
  isProfileChanging: false,
};

let installManager: InstallManager;

interface IInstaller {
  id: string;
  priority: number;
  testSupported: TestSupported;
  install: InstallFunc;
}

const installers: IInstaller[] = [];

const mergers: IFileMerge[] = [];

function registerInstaller(
  id: string,
  priority: number,
  testSupported: TestSupported,
  install: InstallFunc,
  extPath?: string,
  ext?: any,
) {
  installers.push({
    id,
    priority,
    testSupported: wrapExtCBAsync(testSupported, ext),
    install: wrapExtCBAsync(install, ext),
  });
}

function registerMerge(test: MergeTest, merge: MergeFunc, modType: string) {
  mergers.push({ test, merge, modType });
}

const shouldSuppressUpdate = (api: IExtensionApi) => {
  const state = api.getState();
  const suppressOnActivities = [
    "conflicts",
    "installing_dependencies",
    "purging",
  ];
  const isActivityRunning = (activity: string) =>
    getSafe(state, ["session", "base", "activity", "mods"], []).includes(
      activity,
    ) || // purge/deploy
    getSafe(state, ["session", "base", "activity", activity], []).length > 0; // installing_dependencies
  const suppressingActivities = suppressOnActivities.filter((activity) =>
    isActivityRunning(activity),
  );
  const suppressing = suppressingActivities.length > 0;
  if (suppressing) {
    log("info", "skipping settings bake", {
      activities: suppressingActivities,
    });
  }
  return suppressing;
};

function bakeSettings(
  api: IExtensionApi,
  profile: IProfile,
  sortedModList: IMod[],
) {
  return shouldSuppressUpdate(api)
    ? Promise.resolve()
    : api.emitAndAwait("bake-settings", profile.gameId, sortedModList, profile);
}

function showCycles(api: IExtensionApi, cycles: string[][], gameId: string) {
  const id = shortid();
  return api.showDialog(
    "error",
    "Cycles",
    {
      text:
        "Dependency rules between your mods contain cycles, " +
        'like "A after B" and "B after A". You need to remove one of the ' +
        "rules causing the cycle, otherwise your mods can't be " +
        "applied in the right order.",
      links: cycles.map((cycle, idx) => ({
        label: cycle.join(", "),
        action: () => {
          api.closeDialog(id);
          api.events.emit("edit-mod-cycle", gameId, cycle);
        },
      })),
    },
    [{ label: "Close" }],
    id,
  );
}

async function deployModType(
  api: IExtensionApi,
  activator: IDeploymentMethod,
  game: IGame,
  sortedModList: IMod[],
  typeId: string,
  stagingPath: string,
  targetPath: string,
  overwritten: IMod[],
  mergeResult: { [modType: string]: IMergeResultByType },
  lastDeployment: IDeployedFile[],
  onProgress: (text: string, perc: number) => void,
): Promise<IDeployedFile[]> {
  const filteredModList = sortedModList.filter(
    (mod) => (mod.type || "") === typeId,
  );
  log("debug", "Deploying mod type", {
    typeId,
    path: targetPath,
    count: lastDeployment.length,
  });

  const normalize = await getNormalizeFunc(targetPath);
  const newActivation = await deployMods(
    api,
    game.id,
    stagingPath,
    targetPath,
    filteredModList,
    activator,
    lastDeployment,
    typeId,
    new BlacklistSet(
      mergeResult[typeId]?.usedInMerge ?? [],
      game,
      normalize,
    ),
    genSubDirFunc(game, getModType(typeId)),
    onProgress,
  );

  const mergedMap = mergeResult[typeId]?.mergeInfluences;
  if (!!mergedMap && Object.keys(mergedMap).length > 0) {
    newActivation.forEach((act) => {
      const merged = Array.from(new Set(mergedMap[normalize(act.relPath)]));
      if (merged.length > 0) {
        act.merged = merged;
      }
    });
  }
  overwritten.push(
    ...filteredModList.filter(
      (mod) =>
        newActivation.find(
          (entry) =>
            entry.source === mod.installationPath ||
            (entry.merged || []).includes(mod.id),
        ) === undefined,
    ),
  );

  try {
    await doSaveActivation(
      api,
      game.id,
      typeId,
      targetPath,
      stagingPath,
      newActivation,
      activator.id,
    );
  } catch (unknownErr) {
    const err = unknownToError(unknownErr);
    await api.showDialog(
      "error",
      "Saving manifest failed",
      {
        text:
          "Saving the manifest failed (see error below). " +
          "This could lead to errors later on, ",
        message: err.message,
      },
      [],
    );
  }
  return newActivation;
}

async function deployAllModTypes(
  api: IExtensionApi,
  activator: IDeploymentMethod,
  profile: IProfile,
  sortedModList: IMod[],
  stagingPath: string,
  mergeResult: { [modType: string]: IMergeResultByType },
  modPaths: { [typeId: string]: string },
  lastDeployment: { [typeId: string]: IDeployedFile[] },
  newDeployment: { [typeId: string]: IDeployedFile[] },
  onProgress: (text: string, perc: number) => void,
) {
  const game = getGame(profile.gameId);
  const overwritten: IMod[] = [];

  api.dismissNotification("redundant-mods");

  // sequential: deploy order matters per mod type
  for (const typeId of deployableModTypes(modPaths)) {
    const deployment = await deployModType(
      api,
      activator,
      game,
      sortedModList,
      typeId,
      stagingPath,
      modPaths[typeId],
      overwritten,
      mergeResult,
      lastDeployment[typeId],
      onProgress,
    );
    newDeployment[typeId] = deployment;
  }

  if (activator.noRedundancy !== true) {
    return reportRedundant(api, profile.id, overwritten);
  }
}

async function validateDeploymentTarget(api: IExtensionApi, undiscovered: string[]) {
  if (undiscovered.length === 0) {
    return;
  }
  const result = await api.showDialog(
    "error",
    "Deployment target unknown",
    {
      text:
        "The deployment directory for some mod type(s) ({{ types }}) " +
        "is unknown. Mods of these types will not be deployed. " +
        "Maybe this/these type(s) require further configuration or " +
        "external tools.",
      parameters: {
        types: undiscovered.join(", "),
      },
    },
    [{ label: "Cancel" }, { label: "Ignore" }],
  );
  if (result.action === "Cancel") {
    throw new UserCanceled();
  }
}

function checkIncompatibilities(
  api: IExtensionApi,
  profile: IProfile,
  mods: { [modId: string]: IMod },
) {
  const enabledModIds = Object.keys(profile.modState ?? {}).filter(
    (modId) => profile.modState[modId].enabled,
  );

  const enabledMods = enabledModIds.reduce(
    (prev: { [modId: string]: IMod }, modId: string) => {
      if (mods[modId] !== undefined) {
        prev[modId] = mods[modId];
      }
      return prev;
    },
    {},
  );

  const incompatibilities = enabledModIds.reduce((prev, modId) => {
    const conflictRules = (enabledMods[modId]?.rules ?? []).filter(
      (rule) => rule.type === "conflicts",
    );

    return [].concat(
      prev,
      conflictRules
        .map((rule) => findModByRef(rule.reference, enabledMods))
        .filter((mod) => mod !== undefined && mod.id !== modId)
        .map((mod) => ({ left: mods[modId], right: mods[mod.id] })),
    );
  }, []);

  if (incompatibilities.length > 0) {
    const t = api.translate;
    api.sendNotification({
      type: "warning",
      message: "Incompatible mods enabled",
      actions: [
        {
          title: "Show",
          action: () => {
            api.showDialog(
              "info",
              "Incompatible mods",
              {
                md:
                  "You have mods enabled that are marked as being incompatible with each other:\n" +
                  incompatibilities
                    .map(
                      (inc) =>
                        `* "${renderModName(inc.left)}" _${t("incompatible with")}_ "${renderModName(inc.right)}"`,
                    )
                    .join("\n"),
              },
              [{ label: "Close" }],
            );
          },
        },
      ],
    });
    return Promise.reject(new ProcessCanceled("Incompatible mods"));
  } else {
    return Promise.resolve();
  }
}

function doSortMods(
  api: IExtensionApi,
  profile: IProfile,
  mods: { [modId: string]: IMod },
) {
  // sort (all) mods based on their dependencies so the right files get activated
  const modState: { [id: string]: IProfileMod } =
    profile !== undefined ? profile.modState : {};
  const unsorted = Object.keys(mods)
    .map((key: string) => mods[key])
    .filter((mod: IMod) => getSafe(modState, [mod.id, "enabled"], false));

  return sortMods(profile.gameId, unsorted, api).catch((unknownErr) => {
    const err = unknownToError(unknownErr);
    if (unknownErr instanceof CycleError) {
      throw new ProcessCanceled(
        "Deployment is not possible when you have cyclical mod rules. " +
          err.message,
      );
    }
    throw unknownErr;
  });
}

interface IMergeResultByType {
  usedInMerge: string[];
  mergeInfluences: { [outPath: string]: string[] };
}

async function doMergeMods(
  api: IExtensionApi,
  game: IGame,
  gameDiscovery: IDiscoveryResult,
  stagingPath: string,
  sortedModList: IMod[],
  modPaths: { [typeId: string]: string },
  lastDeployment: { [typeId: string]: IDeployedFile[] },
): Promise<{ [typeId: string]: IMergeResultByType }> {
  const fileMergers = mergers.reduce((prev: IResolvedMerger[], merge) => {
    const match = merge.test(game, gameDiscovery);
    if (match !== undefined) {
      prev.push({ match, merge: merge.merge, modType: merge.modType });
    }
    return prev;
  }, []);

  // all mod types that require merging
  const mergeModTypes = Object.keys(modPaths).filter(
    (modType) =>
      fileMergers.find((merger) => merger.modType === modType) !== undefined ||
      (modType === "" && game.mergeArchive !== undefined),
  );

  const result: { [typeId: string]: IMergeResultByType } = Object.keys(
    modPaths,
  ).reduce((prev, modType) => {
    prev[modType] = { usedInMerge: [], mergeInfluences: {} };
    return prev;
  }, {});

  // sequential: clean up merged mods in order
  for (const typeId of mergeModTypes) {
    const mergePath = truthy(typeId)
      ? MERGED_PATH + "." + typeId
      : MERGED_PATH;
    await fs.removeAsync(path.join(stagingPath, mergePath));
  }

  // sequential: update merged mods in order
  for (const typeId of mergeModTypes) {
    const mergeResult = await mergeMods(
      api,
      game,
      stagingPath,
      modPaths[typeId],
      sortedModList.filter(
        (mod) =>
          (mod.type || "") === typeId &&
          mod.installationPath !== undefined,
      ),
      lastDeployment[typeId],
      fileMergers.filter((merger) => merger.modType === typeId),
    );
    // some transformation required because in a merge we may use files from one modtype
    // to generate a file for another. usedInMerge is used to skip files already applied to
    // a merge so we need that information when processing the mod type where the merge source
    // came from.
    // However the list of sources used to generate a merge we need in the modtype used to
    // deploy the merge

    const { usedInMerge, mergeInfluences } = mergeResult;
    result[typeId].usedInMerge = usedInMerge;
    Object.keys(mergeInfluences).forEach((outPath) => {
      if (result[mergeInfluences[outPath].modType] === undefined) {
        result[mergeInfluences[outPath].modType] = {
          usedInMerge: [],
          mergeInfluences: {},
        };
      }
      result[mergeInfluences[outPath].modType].mergeInfluences[
        outPath
      ] = [
        ...(result[mergeInfluences[outPath].modType].mergeInfluences[
          outPath
        ] ?? []),
        ...mergeInfluences[outPath].sources,
      ];
    });
  }

  return result;
}

function reportRedundant(
  api: IExtensionApi,
  profileId: string,
  overwritten: IMod[],
) {
  const t = api.translate;
  if (overwritten.length > 0) {
    const profile = profileById(api.getState(), profileId);
    const renderEntry =
      api.events.listenerCount("display-report") > 0
        ? (mod: IMod) =>
            renderModName(mod) +
            ` [url="cb://report/${mod.id}"]${t("Review")}[/url]`
        : (mod: IMod) => renderModName(mod);

    api.sendNotification({
      id: "redundant-mods",
      type: "info",
      message: "Some mods are redundant",
      actions: [
        {
          title: "Show",
          action: (dismiss) => {
            return api
              .showDialog(
                "info",
                t("Redundant mods"),
                {
                  bbcode: t(
                    "Some of the enabled mods either contain no files or all files " +
                      "they do contain are entirely overwritten by another mod. " +
                      "These redundant mods don't do any harm except slow down " +
                      "deployment a bit.\n" +
                      "If you believe this to be a mistake, please check the file " +
                      "conflicts [svg]conflict[/svg] for the mod in question.",
                  ),
                  checkboxes: overwritten.map(
                    (mod: IMod): ICheckbox => ({
                      id: mod.id,
                      bbcode: renderEntry(mod),
                      value: true,
                    }),
                  ),
                  options: {
                    translated: false,
                    bbcodeContext: {
                      callbacks: {
                        report: (modId: string) => {
                          api.events.emit(
                            "display-report",
                            modId,
                            profile.gameId,
                            {
                              hashes: false,
                              loadOrder: false,
                            },
                          );
                        },
                      },
                    },
                  },
                },
                [
                  { label: "Disable selected" },
                  { label: "Close", default: true },
                ],
              )
              .then((result) => {
                if (result.action === "Disable selected") {
                  Object.keys(result.input)
                    .filter((modId) => result.input[modId])
                    .forEach((modId) => {
                      api.store.dispatch(
                        setModEnabled(profileId, modId, false),
                      );
                    });
                  dismiss();
                }
              });
          },
        },
      ],
    });
  }
  return Promise.resolve();
}

function deployableModTypes(modPaths: { [typeId: string]: string }) {
  return Object.keys(modPaths).filter((typeId) => truthy(modPaths[typeId]));
}

function genUpdateModDeployment(installManager: InstallManager) {
  return (
    api: IExtensionApi,
    manual: boolean,
    profileId?: string,
    progressCB?: (text: string, percent: number) => void,
    deployOptions?: IDeployOptions,
  ): Promise<void> => {
    const t = api.translate;

    const notification: INotification = {
      type: "activity",
      message: t("Waiting for other operations to complete"),
      title: t("Deploying"),
    };

    const progress = (text: string, percent: number) => {
      log("debug", "deployment progress", { text, percent });
      if (progressCB !== undefined) {
        progressCB(text, percent);
      }
      api.store.dispatch(updateNotification(notification.id, percent, text));
    };
    const state: IState = api.store.getState();
    let profile: IProfile = state.persistent.profiles?.[profileId] ?? activeProfile(state);

    if (
      Object.keys(getSafe(state, ["session", "base", "toolsRunning"], {}))
        .length > 0
    ) {
      api.sendNotification({
        type: "info",
        id: "deployment-not-possible",
        message: "Can't deploy while the game or a tool is running",
        displayMS: 5000,
      });
      return Promise.resolve();
    }

    if (profile === undefined) {
      // Used to report an exception here but I don't think this is an error, the call
      // can be delayed so it's completely possible there is no profile active at the the time
      // or has been deleted by then. Rare but not a bug
      api.store.dispatch(dismissNotification(notification.id));
      return Promise.resolve();
    }
    const gameId = profile.gameId;
    const gameDiscovery = state.settings.gameMode.discovered?.[gameId];
    const game = getGame(gameId);
    if (game === undefined || gameDiscovery?.path === undefined) {
      const err = new Error("Game no longer available");
      err["attachLogOnReport"] = true;
      return Promise.reject(err);
    }
    const stagingPath = installPathForGame(state, gameId);

    const modPaths = game.getModPaths(gameDiscovery.path);
    const activator = getCurrentActivator(state, gameId, true);

    if (activator === undefined) {
      const selectedActivator = getSelectedActivator(state, gameId);
      const types = deployableModTypes(modPaths);

      const err = allTypesSupported(selectedActivator, state, gameId, types);
      if (selectedActivator !== undefined) {
        if (err.errors.length > 0) {
          api.showErrorNotification(
            "Deployment not possible",
            t(
              'Deployment method "{{method}}" not available because: {{reason}}',
              {
                replace: {
                  method: selectedActivator.name,
                  reason: err.errors[0].description(t),
                },
              },
            ),
            {
              id: "deployment-not-possible",
              allowReport: false,
            },
          );
        } else if (err.warnings.length > 0) {
          api.sendNotification({
            type: "warning",
            message: t(
              'Deployment method "{{method}}" does not support ' +
                "all mod types: {{reason}}",
              {
                replace: {
                  method: selectedActivator.name,
                  reason: err.warnings[0].description(t),
                },
              },
            ),
            allowSuppress: true,
          });
        }
      } // otherwise there should already be a notification
      return Promise.resolve();
    }

    const newDeployment: { [typeId: string]: IDeployedFile[] } = {};

    // will contain all mods fully overwritten (this also includes mods that didn't
    // files to begin with)
    let sortedModList: IMod[];

    const userGate = () => {
      if (!appContext.isProfileChanging && game.deploymentGate !== undefined) {
        return game.deploymentGate();
      } else {
        return activator.userGate();
      }
    };

    const enabledModCount = enabledModCountForProfile(state, profile.id);

    // test if anything was changed by an external application
    return Promise.resolve(withTrackedActivity(
      "vortex.mod-management",
      "deployment.deploy",
      {
        "deployment.gameId": gameId,
        "deployment.method": activator.name,
        "deployment.modCount": enabledModCount,
        "deployment.manual": manual,
      },
      async () => {
        if (!manual) {
          await userGate();
        }
        notification.id = api.sendNotification(notification);

        try {
          await withActivationLock(async () => {
            log("debug", "deploying mods", {
              game: gameId,
              profile: profile?.id,
              method: activator.name,
            });

            // Wait for active mod installations to complete before deploying.
            // This prevents the external changes dialog from appearing during
            // batch updates/reinstalls where detected changes are expected.
            let hadActiveInstalls = false;
            if (installManager.getActiveInstallationCount() > 0) {
              hadActiveInstalls = true;
              log("debug", "waiting for active installations before deploying");
              await installManager.waitForIdle();
            }

            let mergeResult: { [modType: string]: IMergeResultByType };
            const lastDeployment: { [typeId: string]: IDeployedFile[] } = {};
            const mods: Record<string, IMod> = state.persistent.mods?.[profile?.gameId];
            notification.message = t("Deploying mods");
            api.sendNotification(notification);
            api.store.dispatch(startActivity("mods", "deployment"));
            progress(t("Loading deployment manifest"), 0);

            // sequential: load activation order matters per mod type
            for (const typeId of deployableModTypes(modPaths)) {
              const deployedFiles = await loadActivation(
                api,
                gameId,
                typeId,
                modPaths[typeId],
                stagingPath,
                activator,
              );
              lastDeployment[typeId] = deployedFiles;
            }

            progress(t("Running pre-deployment events"), 2);
            await api.emitAndAwait(
              "will-deploy",
              profile.id,
              lastDeployment,
              deployOptions,
            );

            // need to update the profile so that if a will-deploy handler disables a mod, that
            // actually has an affect on this deployment
            const updatedState = api.getState();
            const updatedProfile =
              updatedState.persistent.profiles[profile.id];
            if (updatedProfile !== undefined) {
              profile = updatedProfile;
            } else {
              // I don't think this can happen
              log("warn", "profile no longer found?", profileId);
            }

            progress(t("Checking for external changes"), 5);
            await dealWithExternalChanges(
              api,
              activator,
              profileId,
              stagingPath,
              modPaths,
              lastDeployment,
              hadActiveInstalls,
            );

            progress(t("Checking for mod incompatibilities"), 25);
            await checkIncompatibilities(api, profile, mods);

            progress(t("Sorting mods"), 30);
            sortedModList = await doSortMods(api, profile, mods);

            progress(t("Merging mods"), 35);
            mergeResult = await doMergeMods(
              api,
              game,
              gameDiscovery,
              stagingPath,
              sortedModList,
              modPaths,
              lastDeployment,
            );

            progress(t("Starting deployment"), 35);
            const deployProgress = (name, percent) =>
              progress(t("Deploying: ") + name, 50 + percent / 2);

            const undiscovered = Object.keys(modPaths).filter(
              (typeId) => !truthy(modPaths[typeId]),
            );
            await validateDeploymentTarget(api, undiscovered);
            await deployAllModTypes(
              api,
              activator,
              profile,
              sortedModList,
              stagingPath,
              mergeResult,
              modPaths,
              lastDeployment,
              newDeployment,
              deployProgress,
            );
          });

          // at this point the deployment lock gets released so another deployment
          // can be started during post-deployment
          progress(t("Running post-deployment events"), 99);
          await api.emitAndAwait(
            "did-deploy",
            profile.id,
            newDeployment,
            (title: string) => progress(title, 99),
            deployOptions,
          );

          api.events.emit("mods-did-deploy", profile.id, newDeployment);
          progress(t("Preparing game settings"), 100);

          await bakeSettings(api, profile, sortedModList);

          api.store.dispatch(setDeploymentNecessary(game.id, false));
        } catch (unknownErr) {
          const err = unknownToError(unknownErr);
          if (err instanceof UserCanceled) {
            // nop
          } else if (err instanceof ProcessCanceled) {
            api.sendNotification({
              type: "warning",
              title: "Deployment interrupted",
              message: err.message,
            });
          } else if (err instanceof TemporaryError) {
            api.showErrorNotification(
              "Failed to deploy mods, please try again",
              err.message,
              { allowReport: false },
            );
          } else if (err instanceof CycleError) {
            api.sendNotification({
              id: "mod-cycle-warning",
              type: "warning",
              message: "Mod rules contain cycles",
              actions: [
                {
                  title: "Show",
                  action: () => {
                    showCycles(api, (err).cycles, profile.gameId);
                  },
                },
              ],
            });
          } else {
            if (err["code"] === undefined && err["errno"] !== undefined) {
              // unresolved windows error code
              api.showErrorNotification("Failed to deploy mods", {
                error: err,
                ErrorCode: err["errno"],
              });
            } else {
              // Error codes that we can't debug without a log.
              const attachLogErrCodes: string[] = ["ELOOP"];
              if (attachLogErrCodes.includes(err["code"])) {
                err["attachLogOnReport"] = true;
              }
              const isFSErr = ["EMFILE"].includes(err["code"]);
              if (isFSErr) {
                err.message =
                  "A filesystem error prevented deploying some files. " +
                  "please try deploying again.\n" +
                  err.message;
              }
              api.showErrorNotification("Failed to deploy mods", err, {
                allowReport:
                  err["code"] !== "EPERM" && !isFSErr && err["allowReport"] !== false,
              });
            }
          }
        } finally {
          api.store.dispatch(stopActivity("mods", "deployment"));
          api.dismissNotification(notification.id);
        }
      },
    ));
  };
}

function doSaveActivation(
  api: IExtensionApi,
  gameId: string,
  typeId: string,
  deployPath: string,
  stagingPath: string,
  files: IDeployedFile[],
  activatorId: string,
) {
  const state: IState = api.store.getState();
  return Promise.resolve(saveActivation(
    gameId,
    typeId,
    state.app.instanceId,
    deployPath,
    stagingPath,
    files,
    activatorId,
  )).catch((err) => {
    const canceled = err instanceof UserCanceled;
    let text = canceled
      ? "You canceled the writing of the manifest file."
      : "Saving the manifest failed (see error below).";

    text +=
      "This could lead to errors " +
      "(e.g. orphaned files in the game directory, external changes not being detected) " +
      'later on. Please either retry or immediately "purge" after this and try ' +
      "deploying again.";
    return api
      .showDialog(
        "error",
        "Saving manifest failed",
        {
          text,
          message: canceled ? undefined : unknownToError(err).stack,
        },
        [{ label: "Retry" }, { label: "Ignore" }],
      )
      .then((result) =>
        result.action === "Retry"
          ? doSaveActivation(
              api,
              gameId,
              typeId,
              deployPath,
              stagingPath,
              files,
              activatorId,
            )
          : Promise.resolve(),
      );
  });
}

function genModsSourceAttribute(api: IExtensionApi): ITableAttribute<IMod> {
  return {
    id: "modSource",
    name: "Source",
    help: getText("source", laterT),
    description: "Source the mod was downloaded from",
    icon: "database",
    placement: "both",
    isSortable: true,
    isToggleable: true,
    isGroupable: true,
    isDefaultVisible: false,
    supportsMultiple: true,
    calc: (mod) => {
      if (mod.attributes === undefined) {
        return "None";
      }
      const source = getModSources().find(
        (iter) => iter.id === mod.attributes["source"],
      );
      return source !== undefined ? source.name : "None";
    },
    edit: {
      choices: () =>
        getModSources()
          .filter((source) => {
            if (
              source.options === undefined ||
              source.options.condition === undefined
            ) {
              return true;
            }
            return source.options.condition();
          })
          .map((source) => {
            const icon =
              source.options !== undefined && source.options.icon !== undefined
                ? source.options.icon
                : undefined;
            return { key: source.id, text: source.name, icon };
          }),
      onChangeValue: (mods: IMod[], newValue: string) => {
        const store = api.store;
        const state = store.getState();
        const gameMode = activeGameId(state);
        mods.forEach((mod) => {
          if (mod.state === "downloaded") {
            store.dispatch(setDownloadModInfo(mod.id, "source", newValue));
          } else {
            store.dispatch(
              setModAttribute(gameMode, mod.id, "source", newValue),
            );
          }
        });
      },
    },
  };
}

function genWebsiteAttribute(api: IExtensionApi): ITableAttribute<IMod> {
  return {
    id: "sourceURL",
    name: laterT("Source website"),
    description: laterT("URL this mod can be downloaded from"),
    icon: "external-link",
    customRenderer: (mod: IMod, detail: boolean, t: TFunction) => {
      if (mod.attributes?.source !== "website") {
        return null;
      }

      const gameId = activeGameId(api.getState());
      return React.createElement(URLInput, { t, mod, gameId }, []);
    },
    calc: (mod: IMod) =>
      mod.attributes?.source === "website"
        ? (mod.attributes?.url ?? null)
        : undefined,
    placement: "detail",
    isToggleable: false,
    edit: {},
    isSortable: false,
    isVolatile: true,
  };
}

function genValidActivatorCheck(api: IExtensionApi) {
  return () =>
    new Promise<ITestResult>((resolve, reject) => {
      const state = api.store.getState();
      if (getSupportedActivators(state).length > 0) {
        return resolve(undefined);
      }

      const gameId = activeGameId(state);
      const modPaths = modPathsForGame(state, gameId);

      if (modPaths === undefined) {
        return resolve(undefined);
      }

      type IUnavailableReasonEx = IUnavailableReason & { activator?: string };

      const reasons: IUnavailableReasonEx[] = getAllActivators().map(
        (activator) => {
          const problems = allTypesSupported(
            activator,
            state,
            gameId,
            Object.keys(modPaths),
          );
          return { activator: activator.id, ...problems.errors[0] };
        },
      );

      if (reasons.indexOf(undefined) !== -1) {
        // why didn't getSupportedActivators not find this? Only reason I can think of
        // is the early-out conditions, getSupportedActivators returns an empty list
        // if the game isn't discovered or not known any more
        return resolve(undefined);
      }

      return resolve({
        description: {
          short: "Mods can't be deployed.",
        },
        severity: "error",
        automaticFix: (): Promise<void> => {
          api.store.dispatch(
            setDeploymentProblem(
              reasons
                .map((reason) => {
                  let message: string;
                  if (_.isFunction(reason.description)) {
                    message = reason.description(api.translate);
                  } else {
                    log(
                      "error",
                      "deployment unavailable with no description",
                      {
                        gameId,
                        reason: JSON.stringify(reason),
                      },
                    );
                    message =
                      "<Missing description, please report this and include a log file>";
                  }
                  return {
                    activator: reason.activator,
                    message,
                    solution:
                      reason.solution !== undefined
                        ? reason.solution(api.translate)
                        : undefined,
                    order: reason.order || 1000,
                    hasAutomaticFix: reason.fixCallback !== undefined,
                  };
                })
                .sort((lhs, rhs) => lhs.order - rhs.order),
            ),
          );
          return Promise.resolve();
        },
      });
    });
}

function attributeExtractor(input: any) {
  return Promise.resolve({
    version: getSafe(input.meta, ["fileVersion"], undefined),
    logicalFileName: getSafe(input.meta, ["logicalFileName"], undefined),
    rules: getSafe(input.meta, ["rules"], undefined),
    source: input.meta?.source,
    category: getSafe(input.meta, ["details", "category"], undefined),
    description: getSafe(input.meta, ["details", "description"], undefined),
    author: getSafe(input.meta, ["details", "author"], undefined),
    homepage: getSafe(input.meta, ["details", "homepage"], undefined),
    variant: getSafe(input.custom, ["variant"], undefined),
  });
}

function upgradeExtractor(input: any) {
  return Promise.resolve({
    category: getSafe(input.previous, ["category"], undefined),
    customFileName: getSafe(input.previous, ["customFileName"], undefined),
    variant: getSafe(input.previous, ["variant"], undefined),
    notes: getSafe(input.previous, ["notes"], undefined),
    icon: getSafe(input.previous, ["icon"], undefined),
    color: getSafe(input.previous, ["color"], undefined),
  });
}

function cleanupIncompleteInstalls(api: IExtensionApi) {
  const store: Redux.Store<IState> = api.store;

  const { mods } = store.getState().persistent;

  Object.keys(mods).forEach((gameId) => {
    Object.keys(mods[gameId]).forEach((modId) => {
      const mod = mods[gameId][modId];
      if (mod.state === "installing") {
        if (mod.installationPath !== undefined) {
          const instPath = installPathForGame(store.getState(), gameId);
          const fullPath = path.join(instPath, mod.installationPath);
          log("warn", "mod was not installed completely and will be removed", {
            mod,
            fullPath,
          });
          // this needs to be synchronous because once is synchronous and we have to complete this
          // before the application fires the gamemode-changed event because at that point we
          // create new mods from the unknown directories (especially the .installing ones)
          try {
            fs.removeSync(fullPath);
          } catch (err) {
            const code = getErrorCode(err);
            if (code !== "ENOENT") {
              log("error", "failed to clean up", err);
            }
          }
          try {
            fs.removeSync(fullPath + ".installing");
          } catch (err) {
            const code = getErrorCode(err);
            if (code !== "ENOENT") {
              log("error", "failed to clean up", err);
            }
          }
        }
        store.dispatch(removeMod(gameId, modId));
      }
    });
  });
}

function onModsEnabled(api: IExtensionApi, deploymentTimer: Debouncer) {
  // TODO: Make sure the file overrides are checked on mod enable/disable!
  return (
    mods: string[],
    enabled: boolean,
    gameId: string,
    options?: IEnableOptions,
  ) => {
    const { store } = api;
    const state: IState = store.getState();
    const { notifications } = state.session.notifications;
    const notiIds = new Set(notifications.map((noti) => noti.id));
    mods.forEach((modId) => {
      const notiId = `may-enable-${modId}`;
      if (notiIds.has(notiId)) {
        api.dismissNotification(notiId);
      }
    });
    if (
      state.settings.automation.deploy &&
      options?.allowAutoDeploy !== false
    ) {
      deploymentTimer.schedule(undefined, false);
    } else if (!state.persistent.deployment.needToDeploy[gameId]) {
      store.dispatch(setDeploymentNecessary(gameId, true));
    }
  };
}

function onDeploySingleMod(api: IExtensionApi) {
  return async (gameId: string, modId: string, enable?: boolean) => {
    const state: IState = api.store.getState();
    const game = getGame(gameId);
    const discovery = getSafe(
      state,
      ["settings", "gameMode", "discovered", gameId],
      undefined,
    );
    if (
      game === undefined ||
      discovery === undefined ||
      discovery.path === undefined
    ) {
      return;
    }
    const mod: IMod = getSafe(
      state,
      ["persistent", "mods", game.id, modId],
      undefined,
    );
    if (mod === undefined) {
      return;
    }
    const activator = getCurrentActivator(state, gameId, false);

    if (activator === undefined) {
      return;
    }

    const dataPath = game.getModPaths(discovery.path)[mod.type || ""];
    if (!truthy(dataPath)) {
      return;
    }
    const stagingPath: string = installPathForGame(state, gameId);
    let modPath: string;

    try {
      modPath = path.join(stagingPath, mod.installationPath);
    } catch (err) {
      err["StagingPath"] = stagingPath || "<undefined>";
      err["InstallPath"] = mod.installationPath || "<undefined>";
      err["GameId"] = gameId || "<undefined>";
      api.showErrorNotification("Failed to deploy mod", err, {
        message: modId,
      });
      return;
    }

    const subdir = genSubDirFunc(game, getModType(mod.type));
    await withActivationLock(async () => {
      try {
        const normalize = await getNormalizeFunc(dataPath);
        const lastActivation = await loadActivation(
          api,
          gameId,
          mod.type,
          dataPath,
          stagingPath,
          activator,
        );
        await activator.prepare(dataPath, false, lastActivation, normalize);
        if (mod !== undefined) {
          if (enable !== false) {
            await activator.activate(
              modPath,
              mod.installationPath,
              subdir(mod),
              new BlacklistSet(mod.fileOverrides ?? [], game, normalize),
            );
          } else {
            await activator.deactivate(modPath, subdir(mod), mod.installationPath);
          }
        }
        const newActivation = await activator.finalize(gameId, dataPath, stagingPath);
        await doSaveActivation(
          api,
          gameId,
          mod.type,
          dataPath,
          stagingPath,
          newActivation,
          activator.id,
        );
      } catch (unknownErr) {
        if (activator.cancel !== undefined) {
          activator.cancel(gameId, dataPath, stagingPath);
        }
        const err = unknownToError(unknownErr);
        if (err instanceof ProcessCanceled) {
          api.sendNotification({
            type: "warning",
            title: "Deployment interrupted",
            message: err.message,
          });
        } else {
          const userCanceled = err instanceof UserCanceled;
          api.showErrorNotification("Failed to deploy mod", err, {
            message: modId,
            allowReport: !userCanceled,
          });
        }
      }
    });
  };
}

function onNeedToDeploy(api: IExtensionApi, current: any) {
  const deploy = () => {
    api.events.emit(
      "deploy-mods",
      onceCB((err) => {
        if (err !== null) {
          if (err instanceof UserCanceled) {
            // Nothing to see here, move along.
            return;
          } else if (err instanceof NoDeployment) {
            showError(
              api.store.dispatch,
              "You need to select a deployment method in settings",
              undefined,
              { allowReport: false },
            );
          } else {
            showError(api.store.dispatch, "Failed to activate mods", err);
          }
        }
      }),
    );
  };

  const autoDeploy = api.getState().settings.automation.deploy;
  const deployAction = {
    title: "Deploy",
    action: (dismiss) => {
      dismiss();
      deploy();
    },
  };
  const moreAction = {
    title: "More",
    action: (dismiss) => {
      api
        .showDialog(
          "question",
          "Deployment necessary",
          {
            text:
              "Recent changes to the active mods are currently pending, " +
              "a deployment must be run to apply the latest changes to your game.",
            checkboxes: [
              {
                id: "enable-auto-deployment",
                text: "Enable automatic deployment",
                value: false,
              },
            ],
          },
          [{ label: "Later" }, { label: "Deploy" }],
        )
        .then((res) => {
          if (res.input["enable-auto-deployment"]) {
            api.store.dispatch(setAutoDeployment(true));
          }
          if (res.action === "Deploy") {
            dismiss();
            deploy();
          }
        });
    },
  };
  const actions = autoDeploy ? [deployAction] : [deployAction, moreAction];
  if (current) {
    api.sendNotification({
      id: "deployment-necessary",
      type: "info",
      message: "Deployment necessary",
      actions,
    });
  } else {
    api.dismissNotification("deployment-necessary");
  }
}

function once(api: IExtensionApi) {
  const store: Redux.Store<IState> = api.store;

  if (installManager === undefined) {
    installManager = new InstallManager(api, (gameId: string) =>
      installPathForGame(store.getState(), gameId),
    );
    installers.forEach((installer: IInstaller) => {
      installManager.addInstaller(
        installer.id,
        installer.priority,
        installer.testSupported,
        installer.install,
      );
    });
  }

  const updateModDeployment = genUpdateModDeployment(installManager);
  const deploymentTimer = new Debouncer(
    (
      manual: boolean,
      profileId: string,
      progressCB: (text: string, percent: number) => void,
      deployOptions?: IDeployOptions,
    ) => updateModDeployment(api, manual, profileId, progressCB, deployOptions),
    2000,
  );

  api.events.on(
    "deploy-mods",
    (
      callback: (err: Error) => void,
      profileId?: string,
      progressCB?: (text: string, percent: number) => void,
      deployOptions?: IDeployOptions,
    ) => {
      // Can't believe that 7+ years in, we still didn't have deployment options defined.
      if (!(callback as any).called) {
        if (deployOptions?.manual === true) {
          deploymentTimer.runNow(
            callback,
            true,
            profileId,
            progressCB,
            deployOptions,
          );
        } else {
          deploymentTimer.runNow(
            callback,
            false,
            profileId,
            progressCB,
            deployOptions,
          );
        }
      }
    },
  );

  const removeModToastDebouncer = new Debouncer(
    () => {
      api.sendNotification({
        id: "mod-removed",
        type: "info",
        message: "Mod(s) removed",
        displayMS: 3000,
      });

      return Promise.resolve();
    },
    1000,
    true,
    false,
  );

  api.onAsync(
    "did-remove-mod",
    (
      gameMode: string,
      removedId: string,
      modId: string,
      options: {
        silent?: boolean;
        willBeReplaced?: boolean;
        modData?: IMod;
      },
    ) => {
      if (options?.silent !== true && options?.willBeReplaced !== true) {
        removeModToastDebouncer.schedule();
      }
      return Promise.resolve();
    },
  );

  api.onAsync("deploy-single-mod", onDeploySingleMod(api));

  api.onAsync(
    "purge-mods-in-path",
    (gameId: string, modType: string, modPath: string) => {
      return purgeModsInPath(api, gameId, modType, modPath)
        .catch((err) => {
          if (err instanceof UserCanceled) {
            return Promise.resolve();
          }
          if (err instanceof NoDeployment) {
            api.showErrorNotification(
              "Failed to purge mods",
              "No deployment method currently available",
              { allowReport: false },
            );
            return;
          }
          if (err instanceof ProcessCanceled) {
            api.showErrorNotification("Failed to purge mods", err, {
              allowReport: false,
            });
            return;
          }
          api.showErrorNotification("Failed to purge mods", err);
        });
    },
  );

  api.events.on(
    "purge-mods",
    (allowFallback: boolean, callback: (err: Error) => void) => {
      purgeMods(api)
        .catch((err) =>
          allowFallback ? fallbackPurge(api) : Promise.reject(err),
        )
        .then(() => callback(null))
        .catch((err) => callback(unknownToError(err)));
    },
  );

  api.events.on("await-activation", (callback: (err: Error) => void) => {
    deploymentTimer.wait(callback);
  });

  api.events.on("mods-enabled", onModsEnabled(api, deploymentTimer));

  api.events.on("gamemode-activated", (newMode: string) =>
    onGameModeActivated(api, getAllActivators(), newMode),
  );

  api.events.on(
    "install-dependencies",
    (profileId: string, gameId: string, modIds: string[], silent?: boolean) => {
      const state: IState = api.store.getState();
      const profile: IProfile = getSafe(
        state,
        ["persistent", "profiles", profileId],
        undefined,
      );

      Promise.all(modIds.map((modId) =>
        installManager
          .installDependencies(
            api,
            profile,
            gameId,
            modId,
            silent === true,
            false,
          )
          .catch((err) => {
            if ((err instanceof ProcessCanceled)
                || (err instanceof UserCanceled)) {
              return null;
            }
            throw err;
          }),
      )).catch((err) => {
        api.showErrorNotification("Failed to install dependencies", err);
      });
    },
  );

  api.events.on(
    "install-recommendations",
    (profileId: string, gameId: string, modIds: string[]) => {
      try {
        const state: IState = api.store.getState();
        const profile: IProfile = getSafe(
          state,
          ["persistent", "profiles", profileId],
          undefined,
        );
        if (profile === undefined) {
          api.showErrorNotification(
            "Failed to install recommendations",
            "Invalid profile",
          );
        }

        Promise.all(modIds.map((modId) =>
          installManager
            .installRecommendations(api, profile, gameId, modId)
            .catch((err) => {
              if (err instanceof ProcessCanceled) {
                return null;
              }
              throw err;
            }),
        )).catch((err) =>
          api.showErrorNotification("Failed to install recommendations", err),
        );
      } catch (err) {
        api.showErrorNotification("Failed to install recommendations", err);
      }
    },
  );

  api.events.on("mod-enabled", (profileId: string, modId: string) => {
    const state = api.getState();
    const profile = profileById(state, profileId);
    if (profile === undefined) {
      return;
    }
    const mod = state.persistent.mods[profile.gameId]?.[modId];
    if (mod === undefined) {
      return;
    }
    const modType = getModType(mod.type);
    if (modType?.options?.customDependencyManagement === true) {
      return;
    }

    installManager
      .installDependencies(api, profile, profile.gameId, modId, true, false)
      .then(() =>
        installManager.installRecommendations(
          api,
          profile,
          profile.gameId,
          modId,
        ),
      )
      .catch((err) => {
        if (err instanceof ProcessCanceled || err instanceof UserCanceled) {
          return null;
        }
        api.showErrorNotification("Failed to install dependencies", err);
      });
  });

  api.onStateChange(["settings", "mods", "installPath"], (previous, current) =>
    onPathsChanged(api, previous, current),
  );

  api.onStateChange(["persistent", "mods"], (previous, current) =>
    onModsChanged(api, previous, current),
  );

  api.onStateChange(
    ["persistent", "deployment", "needToDeploy"],
    (previous, current) => {
      const gameMode = activeGameId(store.getState());
      if (previous[gameMode] !== current[gameMode]) {
        waitForCondition({
          callback: () => onceCB(() => onNeedToDeploy(api, current[gameMode])),
          condition: () => {
            const installingDeps =
              getSafe(
                api.getState(),
                ["session", "base", "activity", "installing_dependencies"],
                [],
              ).length === 0;
            const activeCollectionInstall = getSafe(
              api.getState(),
              ["session", "collections", "activeSession"],
              undefined,
            );
            return installingDeps && activeCollectionInstall === undefined;
          },
          required: () =>
            getSafe(
              api.getState(),
              ["persistent", "deployment", "needToDeploy", gameMode],
              false,
            ),
        });
      }
    },
  );

  api.events.on(
    "start-install",
    (archivePath: string, callback?: (error, id: string) => void) => {
      const { enable } = api.store.getState().settings.automation;
      installManager.install(
        null,
        archivePath,
        [activeGameId(store.getState())],
        api,
        {
          download: {
            localPath: path.basename(archivePath),
          },
        },
        true,
        enable,
        callback,
      );
    },
  );

  api.events.on(
    "start-install-download",
    (
      downloadId: string,
      optionsIn?: IInstallOptions | boolean,
      callback?: (error, id: string) => void,
    ) => {
      const options =
        optionsIn === undefined
          ? {}
          : typeof optionsIn === "boolean"
            ? { allowAutoEnable: optionsIn }
            : optionsIn;
      void onStartInstallDownload(
        api,
        installManager,
        downloadId,
        options,
        callback,
      );
    },
  );

  api.events.on(
    "remove-mod",
    (
      gameId: string,
      modId: string,
      cb?: (error: Error) => void,
      options?: IRemoveModOptions,
    ) => onRemoveMod(api, getAllActivators(), gameId, modId, cb, options),
  );

  api.events.on(
    "remove-mods",
    (
      gameId: string,
      modIds: string[],
      cb?: (error: Error) => void,
      options?: IRemoveModOptions,
    ) => {
      onRemoveMods(api, getAllActivators(), gameId, modIds, cb, options);
    },
  );

  api.events.on(
    "create-mod",
    (gameMode: string, mod: IMod, callback: (error: Error) => void) => {
      onAddMod(api, gameMode, mod, callback);
    },
  );

  api.events.on("profile-will-change", () => {
    // when the profile changes there is a good chance the cycle warning doesn't apply and if
    // the game changes the cycle dialog can't even be opened or it would trigger an error
    api.dismissNotification("mod-cycle-warning");
    appContext.isProfileChanging = true;
  });

  api.events.on("profile-did-change", () => {
    appContext.isProfileChanging = false;
  });

  api.events.on(
    "simulate-installer",
    (
      gameId: string,
      archiveId: string,
      options: IInstallOptions,
      cb: (instructions: IInstallResult, tempPath: string) => PromiseLike<void>,
    ) => {
      const state = api.getState();
      const download = state.persistent.downloads.files[archiveId];
      const rawGameId = Array.isArray(download?.game)
        ? download.game[0]
        : download?.game;
      const games = knownGames(state);
      const internalGameId = rawGameId
        ? convertGameIdReverse(games, rawGameId) || rawGameId
        : activeGameId(state);
      const downloadPath: string = downloadPathForGame(state, internalGameId);
      const archivePath: string = path.join(downloadPath, download.localPath);
      const tempPath = path.join(
        getVortexPath("temp"),
        `simulating_${archiveId}`,
      );
      return installManager
        .simulate(
          api,
          gameId,
          archivePath,
          tempPath,
          options.fileList,
          true,
          options.choices,
          () => {
            // nop
          },
        )
        .then((instructions) => cb(instructions, tempPath))
        .then(() => fs.removeAsync(tempPath))
        .catch((err) => {
          api.showErrorNotification("Failed to simulate installer", err);
        });
    },
  );

  cleanupIncompleteInstalls(api);

  const cacheModRefActions: Redux.Action[] = [];
  const cacheModRefDebouncer = new Debouncer(() => {
    batchDispatch(api.store, cacheModRefActions);
    return Promise.resolve();
  }, 500);

  setResolvedCB(
    (
      gameId: string,
      sourceModId: string,
      ref: IModReference,
      refModId: string,
    ) => {
      cacheModRefActions.push(
        cacheModReference(gameId, sourceModId, ref, refModId),
      );
      cacheModRefDebouncer.schedule();
    },
  );
}

function checkPendingTransfer(api: IExtensionApi): Promise<ITestResult> {
  let result: ITestResult;
  const state = api.store.getState();

  const gameMode = activeGameId(state);
  if (gameMode === undefined) {
    return Promise.resolve(result);
  }

  const pendingTransfer: string[] = [
    "persistent",
    "transactions",
    "transfer",
    gameMode,
  ];
  const transferDestination = getSafe(state, pendingTransfer, undefined);
  if (transferDestination === undefined) {
    return Promise.resolve(result);
  }

  result = {
    severity: "warning",
    description: {
      short: "Folder transfer was interrupted",
      long:
        "An attempt to move the staging folder was interrupted. You should let " +
        "Vortex clean up now, otherwise you may be left with unnecessary copies of files.",
    },
    automaticFix: () =>
      new Promise<void>((fixResolve, fixReject) => {
        return fs
          .removeAsync(transferDestination)
          .then(() => {
            api.store.dispatch(setTransferMods(gameMode, undefined));
            fixResolve();
          })
          .catch((err) => {
            if (err.code === "ENOENT") {
              // Destination is already gone, that's fine.
              api.store.dispatch(setTransferMods(gameMode, undefined));
              fixResolve();
            } else {
              fixReject(err);
            }
          });
      }),
  };

  return Promise.resolve(result);
}

function openDuplicateLocation(api: IExtensionApi, modId: string) {
  const state = api.getState();
  const gameMode = activeGameId(state);
  const installPath = installPathForGame(state, gameMode);
  const modPath = path.join(installPath, modId);
  opn(modPath).catch(() => null);
}
function getModInfo(api: IExtensionApi, gameMode: string, modId: string) {
  const state = api.getState();
  const mods = state.persistent.mods[gameMode] ?? {};
  const profiles = state.persistent.profiles ?? {};
  const mod = Object.values(mods).find((mod) => mod.id === modId);
  const version = getSafe(mod, ["attributes", "version"], "Unknown");
  const installTime = getSafe(mod, ["attributes", "installTime"], 0);
  const profileId = Object.keys(profiles).find((id) =>
    getSafe(profiles[id], ["modState", modId, "enabled"], false),
  );
  const profName = profiles[profileId]?.name ?? "None";
  return `Profile: ${profName}(${profileId}); Version: ${version}; InstallTime: ${new Date(installTime)}`;
}

function getDuplicateMods(api: IExtensionApi): IDuplicatesMap {
  const state: IState = api.store.getState();
  const gameMode = activeGameId(state);
  if (gameMode === undefined) {
    return undefined;
  }

  if (state.persistent.mods[gameMode] === undefined) {
    return undefined;
  }

  const mods = Object.values(state.persistent.mods[gameMode]);
  const profiles = Object.values(state.persistent.profiles).reduce(
    (accum, profile) => {
      if (profile.gameId === gameMode) {
        accum[profile.id] = { modState: profile.modState, name: profile.name };
      }
      return accum;
    },
    {},
  );

  const getVariantValue = (mod: IMod) => {
    const variant = getSafe(mod.attributes, ["variant"], "");
    return truthy(variant) ? variant : "default";
  };

  const hasProfileReference = (modId: string) => {
    for (const prof of Object.values(profiles)) {
      const enabled = getSafe(prof, ["modState", modId, "enabled"], false);
      if (enabled) {
        return true;
      }
    }
    return false;
  };

  const arcIdsChecked: string[] = [];
  const preselected: string[] = [];
  const duplicates = mods.reduce((accum, m1) => {
    const name = renderModName(m1);
    if (!truthy(m1.archiveId) || arcIdsChecked.includes(m1.archiveId)) {
      return accum;
    }

    const filtered = mods.filter(
      (m2) =>
        m1.id !== m2.id &&
        m1.archiveId === m2.archiveId &&
        getVariantValue(m1) === getVariantValue(m2),
    );
    if (filtered.length > 0) {
      if (accum[name] === undefined) {
        accum[name] = [];
      }
      accum[name].push(m1.id);
      if (!hasProfileReference(m1.id)) {
        preselected.push(m1.id);
        return accum;
      }
      for (const m of filtered) {
        accum[name].push(m.id);
        if (!hasProfileReference(m.id)) {
          preselected.push(m.id);
          continue;
        }
      }
    }
    arcIdsChecked.push(m1.archiveId);
    return accum;
  }, {});
  return Object.keys(duplicates).length > 0
    ? { duplicates, preselected }
    : undefined;
}

function checkDuplicateMods(api: IExtensionApi): Promise<ITestResult> {
  let result: ITestResult;
  const duplicateMap = getDuplicateMods(api);
  if (duplicateMap === undefined) {
    return Promise.resolve(result);
  }

  const preSelectedTxt =
    duplicateMap.preselected.length > 0
      ? ", Vortex has identified and pre-selected some of the duplicate mods as they were not referenced by " +
        "any of your profiles. Given that the mod is not used it should be safe to remove it, but please " +
        "bear in mind that Vortex does not check for manual file modifications - you should double check " +
        "any mod before agreeing to remove it.<br/><br/>"
      : ".<br/><br/>";
  result = {
    severity: "warning",
    description: {
      short: "Potential Duplicate Mods",
      long:
        "Due to a bug in older versions of Vortex, it was possible to duplicate mod entries " +
        "when re-installing recently updated mods.<br/><br/>" +
        `Unfortunately your machine has some of these potential duplicates${preSelectedTxt}` +
        "Proceeding past this point will allow you to select which mods to remove.",
    },
    automaticFix: () =>
      new Promise<void>((fixResolve, fixReject) => {
        api.store.dispatch(setDialogVisible("duplicates-dialog"));
        api.events.on("duplicates-removed", () => {
          fixResolve();
        });
      }),
  };

  return Promise.resolve(result);
}

function checkStagingFolder(api: IExtensionApi): Promise<ITestResult> {
  let result: ITestResult;
  const state = api.store.getState();

  const gameMode = activeGameId(state);

  log("debug", "[checking staging folder]", { gameMode });
  if (gameMode === undefined) {
    return Promise.resolve(result);
  }

  const discovery = currentGameDiscovery(state);
  const instPath = installPath(state);
  const basePath = getVortexPath("application");
  log("debug", "[checking staging folder]", {
    stagingPath: instPath,
    vortexPath: basePath,
    gamePath: discovery?.path,
  });
  if (isChildPath(instPath, basePath)) {
    result = {
      severity: "warning",
      description: {
        short: "Invalid staging folder",
        long:
          "Your mod staging folder is inside the Vortex application directory. " +
          "This is a very bad idea because that folder gets removed during updates so you would " +
          "lose all your files on the next update.",
      },
    };
  } else if (
    discovery !== undefined &&
    discovery.path !== undefined &&
    isChildPath(instPath, discovery.path)
  ) {
    result = {
      severity: "warning",
      description: {
        short: "Invalid staging folder",
        long:
          "Your mod staging folder is inside the game folder.<br/>" +
          "This is a very bad idea because that folder is under the control of the game " +
          "(and potentially Steam or similar) and may be moved or deleted - e.g. when the " +
          "game is updated/repaired.<br/>" +
          "Please choose a separate folder for the staging folder, one that no other " +
          "application uses.",
      },
      automaticFix: () =>
        new Promise<void>((fixResolve, fixReject) => {
          api.events.emit("show-main-page", "application_settings");
          api.store.dispatch(setSettingsPage("Mods"));
          api.highlightControl("#install-path-form", 5000);
          api.events.on("hide-modal", (modal) => {
            if (modal === "settings") {
              fixResolve();
            }
          });
        }),
    };
  }
  return Promise.resolve(result);
}

function init(context: IExtensionContext): boolean {
  context.registerReducer(["session", "mods"], sessionReducer);
  context.registerReducer(["settings", "mods"], settingsReducer);
  context.registerReducer(["persistent", "mods"], modsReducer);
  context.registerReducer(["persistent", "deployment"], deploymentReducer);
  context.registerReducer(["persistent", "transactions"], transactionsReducer);

  const modsActivity = new ReduxProp(
    context.api,
    [["session", "base", "activity", "mods"]],
    (activity: string[]) => activity !== undefined && activity.length > 0,
  );

  context.registerMainPage(
    "mods",
    "Mods",
    LazyComponent(() => require("./views/ModList")),
    {
      priority: 1,
      hotkey: "M",
      group: "per-game",
      visible: () => activeGameId(context.api.store.getState()) !== undefined,
      activity: modsActivity,
      props: () => ({ modSources: getModSources() }),
      mdi: nxmMod,
    },
  );

  context.registerAction("mod-icons", 105, ActivationButton, {}, () => ({
    key: "activate-button",
    getActivators: getAllActivators,
  }));

  context.registerAction("mod-icons", 110, DeactivationButton, {}, () => ({
    key: "deactivate-button",
    getActivators: getAllActivators,
  }));

  context.registerAction(
    "mods-action-icons",
    150,
    "start-install",
    {},
    "Install Recommendations",
    (instanceIds: string[]) => {
      const profile = activeProfile(context.api.getState());
      // installRecommendations should already do nothing if there are no recommendations
      // on a mod so no need to make the code more complicated here
      const installSequentially = async () => {
        try {
          // sequential: install order matters per mod
          for (const modId of instanceIds) {
            await installManager.installRecommendations(
              context.api,
              profile,
              profile.gameId,
              modId,
            );
          }
        } catch (err) {
          context.api.showErrorNotification(
            "Failed to install recommendations",
            err,
          );
        }
      };
      void installSequentially();
    },
    (modIds) => {
      // only show the option if there is at least one recommendation not already fulfilled.
      // though this doesn't do the full mod reference lookup, it just goes by id hint
      const state = context.api.getState();
      const gameMode = activeGameId(state);
      const mods = state.persistent.mods[gameMode];

      const hasUnfulfilled = (modId: string) =>
        (mods[modId].rules ?? []).find(
          (rule) =>
            !rule.ignored &&
            rule.type === "recommends" &&
            // if idHint is undefined this rule has never been fulfilled,
            (!rule.reference.idHint ||
              // if the mod can't be found by idHint it probably was removed
              mods[rule.reference.idHint] === undefined),
        );

      const unfulfilled = modIds.find(hasUnfulfilled);

      return unfulfilled !== undefined || "No unfulfilled recommendations";
    },
  );

  const validActivatorCheck = genValidActivatorCheck(context.api);

  context.registerActionCheck(
    "SET_MOD_INSTALLATION_PATH",
    (state, action: any) => {
      if (!truthy(action.payload.installPath)) {
        return `Attempt to set an invalid mod installation path`;
      }

      return undefined;
    },
  );

  context.registerTest(
    "valid-activator",
    "gamemode-activated",
    validActivatorCheck,
  );
  context.registerTest(
    "valid-activator",
    "settings-changed",
    validActivatorCheck,
  );

  context.registerSettings(
    "Mods",
    LazyComponent(() => require("./views/Settings")),
    () => ({ activators: getAllActivators() }),
    () => activeGameId(context.api.getState()) !== undefined,
    75,
  );
  context.registerSettings(
    "Workarounds",
    Workarounds,
    undefined,
    undefined,
    1000,
  );

  context.registerDialog(
    "external-changes",
    LazyComponent(() => require("./views/ExternalChangeDialog")),
  );
  context.registerDialog(
    "fix-deployment",
    LazyComponent(() => require("./views/FixDeploymentDialog")),
    () => ({
      // nop
    }),
  );

  context.registerDialog(
    "duplicates-dialog",
    LazyComponent(() => require("./views/DuplicatesDialog")),
    () => ({
      onGetDuplicates: () => getDuplicateMods(context.api),
      onRemoveMods: (dupMap: IRemoveDuplicateMap) => {
        const state = context.api.getState();
        const gameMode = activeGameId(state);
        const profiles = getSafe(state, ["persistent", "profiles"], {});
        const batchedActions = [];
        const modIds = Object.keys(dupMap);
        for (const modId of modIds) {
          for (const profileId in profiles) {
            const enabled = getSafe(
              profiles[profileId],
              ["modState", modId, "enabled"],
              false,
            );
            batchedActions.push(forgetMod(profileId, modId));
            if (enabled) {
              if (dupMap[modId] !== undefined) {
                batchedActions.push(
                  setModEnabled(profileId, dupMap[modId], enabled),
                );
              }
            }
          }
        }
        context.api.closeDialog("duplicates-dialog");
        if (batchedActions.length > 0) {
          context.api.events.emit("remove-mods", gameMode, modIds, (err) => {
            if (!err) {
              context.api.events.emit("duplicates-removed");
              batchDispatch(context.api.store.dispatch, batchedActions);
            } else if (
              !(err instanceof UserCanceled) &&
              !(err instanceof ProcessCanceled)
            ) {
              context.api.showErrorNotification("Failed to remove mods", err);
            }
          });
        }
      },
      openDuplicateLocation: (modId: string) =>
        openDuplicateLocation(context.api, modId),
      getModInfo: (gameMode: string, modId: string) =>
        getModInfo(context.api, gameMode, modId),
    }),
  );

  context.registerTableAttribute("mods", genModsSourceAttribute(context.api));
  context.registerTableAttribute("mods", genWebsiteAttribute(context.api));

  context.registerTest("validate-staging-folder", "gamemode-activated", () =>
    checkStagingFolder(context.api),
  );
  context.registerTest("validate-staging-folder", "settings-changed", () =>
    checkStagingFolder(context.api),
  );
  context.registerTest("verify-mod-transfers", "gamemode-activated", () =>
    checkPendingTransfer(context.api),
  );
  context.registerTest("verify-mod-duplicates", "gamemode-activated", () =>
    checkDuplicateMods(context.api),
  );

  context.registerDeploymentMethod = registerDeploymentMethod;
  context.registerInstaller = registerInstaller;
  context.registerAttributeExtractor = registerAttributeExtractor;
  context.registerModSource = registerModSource;
  context.registerMerge = registerMerge;

  context.registerActionCheck("ADD_MOD", (state, action: any) => {
    const { mod }: { mod: IMod } = action.payload;
    if (!truthy(mod.installationPath)) {
      return "Can't create mod without installation path";
    }

    return undefined;
  });

  context.registerActionCheck("ADD_MODS", (state, action: any) => {
    const { mods }: { mods: IMod[] } = action.payload;
    if (mods.find((iter) => !truthy(iter.installationPath)) !== undefined) {
      return "Can't create mod without installation path";
    }

    return undefined;
  });

  registerModSource("user-generated", "User-Generated");
  registerModSource("website", "Website");
  registerModSource("unsupported", "Other");

  registerAttributeExtractor(150, attributeExtractor);
  registerAttributeExtractor(10, upgradeExtractor);

  registerInstaller(
    "fallback",
    1000,
    basicInstaller.testSupported,
    basicInstaller.install,
  );

  context.registerStartHook(100, "check-deployment", (input) =>
    preStartDeployHook(context.api, input),
  );

  const history = new ModHistory(context.api);

  context.registerHistoryStack("mods", history);
  context.registerAction("mod-icons", 200, "history", {}, "History", () => {
    context.api.ext.showHistory?.("mods");
  });

  context.once(() => {
    once(context.api);

    Object.assign(context.api.ext, extendApi(context.api, installManager));

    history.init();
  });

  return true;
}

export default init;
