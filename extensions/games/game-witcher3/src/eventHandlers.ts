/* eslint-disable */
import { actions, types, selectors, util } from "@nexusmods/vortex-api";

import { setRemasterNoticeSeen } from "./actions";
import {
  GAME_ID,
  getRemasterNoticeSeenBranch,
  PART_SUFFIX,
  INPUT_XML_FILENAME,
  SCRIPT_MERGER_ID,
  I18N_NAMESPACE,
} from "./common";
import { detectEdition, W3Edition } from "./edition";
import IniStructure from "./iniParser";
import { sortLoadOrderAlphabetically } from "./loadOrderSort";
import * as menuMod from "./menumod";
import { storeToProfile, restoreFromProfile } from "./mergeBackup";
import { getPersistentLoadOrder } from "./migrations";
import { autoSortLoadOrderEnabled } from "./selectors";
import { IRemoveModOptions } from "./types";
import {
  validateProfile,
  forceRefresh,
  suppressEventHandlers,
  notifyMissingScriptMerger,
  shouldNotifyMissingScriptMerger,
} from "./util";

type Deployment = { [modType: string]: types.IDeployedFile[] };

/**
 * Shown once, the first time a Remastered install is managed. The upgrade
 * invalidates merged scripts and changes what the game will load, none of
 * which surfaces anywhere else until something has already gone wrong.
 *
 * Deliberately not tied to edition transitions: someone who keeps both
 * editions installed would otherwise see this every time they switch.
 */
function notifyRemasterOnce(api: types.IExtensionApi) {
  const state = api.getState();
  if (util.getSafe(state, getRemasterNoticeSeenBranch(), false)) {
    return;
  }

  const discovery = selectors.discoveryByGame(state, GAME_ID);
  if (detectEdition(discovery?.path) !== W3Edition.Remastered) {
    return;
  }

  api.store.dispatch(setRemasterNoticeSeen(true));
  api.sendNotification({
    id: "witcher3-remaster-detected",
    type: "info",
    message: "The Witcher 3 Remastered detected - some mods need attention",
    allowSuppress: true,
    actions: [
      {
        title: "More",
        action: (dismiss) => {
          dismiss();
          api.showDialog(
            "info",
            "The Witcher 3 Remastered",
            {
              bbcode:
                "This edition changes how mods are loaded. A few things to be aware of:[br][/br][br][/br]" +
                "• Merged scripts from a previous install are no longer valid. Run the Script " +
                "Merger again, or remove the merged mod, before playing.[br][/br][br][/br]" +
                "• Script mods built for earlier versions may fail to compile. Map, map pin, " +
                "Gwent and loot interface mods are the most affected.[br][/br][br][/br]" +
                "• The game can now switch off locally installed mods by itself. If nothing " +
                "loads, check the mod settings in game or run Vortex's health checks.[br][/br][br][/br]" +
                "• Mod folder names longer than 63 characters are ignored by the game.[br][/br][br][/br]" +
                "• DirectX 11 has been removed, so DirectX 11 only tools will not run.",
            },
            [{ label: "Close" }],
          );
        },
      },
    ],
  });
}

export function onGameModeActivation(api: types.IExtensionApi) {
  return async (gameMode: string) => {
    if (gameMode !== GAME_ID) {
      // Just in case the script merger notification is still
      //  present.
      api.dismissNotification("witcher3-merge");
    } else {
      const state = api.getState();
      const lastProfId = selectors.lastActiveProfileForGame(state, gameMode);
      const activeProf = selectors.activeProfile(state);
      notifyRemasterOnce(api);
      if (lastProfId !== activeProf?.id) {
        try {
          await storeToProfile(api, lastProfId).then(() => restoreFromProfile(api, activeProf?.id));
        } catch (err) {
          api.showErrorNotification("Failed to restore profile merged files", err);
        }
      }
    }
  };
}

export const onWillDeploy = (api: types.IExtensionApi) => {
  return async (profileId: string, deployment: Deployment) => {
    const state = api.store.getState();
    const activeProfile = validateProfile(profileId, state);
    if (activeProfile === undefined || suppressEventHandlers(api)) {
      return Promise.resolve();
    }

    return menuMod
      .onWillDeploy(api, deployment, activeProfile)
      .catch((err) => (err instanceof util.UserCanceled ? Promise.resolve() : Promise.reject(err)));
  };
};

const applyToIniStruct = (api: types.IExtensionApi, modIds: string[]) => {
  const currentLO = getPersistentLoadOrder(api);
  const newLO: types.ILoadOrderEntry[] = [
    ...currentLO.filter((entry) => !modIds.includes(entry.modId)),
  ];
  IniStructure.getInstance(api)
    .setINIStruct(newLO)
    .then(() => forceRefresh(api));
};

export const onModsDisabled = (api: types.IExtensionApi) => {
  return async (modIds: string[], enabled: boolean, gameId: string) => {
    if (gameId !== GAME_ID || enabled) {
      return;
    }
    applyToIniStruct(api, modIds);
  };
};

export const onDidRemoveMod = (api: types.IExtensionApi) => {
  return async (gameId: string, modId: string, removeOpts: IRemoveModOptions) => {
    if (GAME_ID !== gameId || removeOpts?.willBeReplaced) {
      return Promise.resolve();
    }
    applyToIniStruct(api, [modId]);
  };
};

export const onDidPurge = (api: types.IExtensionApi) => {
  return async (profileId: string, deployment: Deployment) => {
    const state = api.getState();
    const activeProfile = validateProfile(profileId, state);
    if (activeProfile === undefined) {
      return Promise.resolve();
    }

    return IniStructure.getInstance(api).revertLOFile();
  };
};

let prevDeployment: Deployment = {};
export const onDidDeploy = (api: types.IExtensionApi) => {
  return async (profileId: string, deployment: Deployment) => {
    const state = api.getState();
    const activeProfile = validateProfile(profileId, state);
    if (activeProfile === undefined) {
      return Promise.resolve();
    }

    if (JSON.stringify(prevDeployment) !== JSON.stringify(deployment)) {
      prevDeployment = deployment;
      queryScriptMerge(
        api,
        "Your mods state/load order has changed since the last time you ran " +
          "the script merger. You may want to run the merger tool and check whether any new script conflicts are " +
          "present, or if existing merges have become unecessary. Please also note that any load order changes " +
          "may affect the order in which your conflicting mods are meant to be merged, and may require you to " +
          "remove the existing merge and re-apply it.",
      );
    }
    let loadOrder = getPersistentLoadOrder(api);
    if (autoSortLoadOrderEnabled(state)) {
      loadOrder = sortLoadOrderAlphabetically(loadOrder);
    }
    const docFiles = (deployment["witcher3menumodroot"] ?? []).filter(
      (file) =>
        file.relPath.endsWith(PART_SUFFIX) && file.relPath.indexOf(INPUT_XML_FILENAME) === -1,
    );
    const menuModPromise = () => {
      if (docFiles.length === 0) {
        // If there are no menu mods deployed - remove the mod.
        return menuMod.removeMenuMod(api, activeProfile);
      } else {
        return menuMod.onDidDeploy(api, deployment, activeProfile).then(async (modId: string) => {
          if (modId === undefined) {
            return Promise.resolve();
          }

          api.store.dispatch(actions.setModEnabled(activeProfile.id, modId, true));
          await api.emitAndAwait("deploy-single-mod", GAME_ID, modId, true);
          return Promise.resolve();
        });
      }
    };

    return menuModPromise()
      .then(() => IniStructure.getInstance().setINIStruct(loadOrder))
      .then(() => {
        forceRefresh(api);
        return Promise.resolve();
      })
      .catch((err) =>
        IniStructure.getInstance().modSettingsErrorHandler(err, "Failed to modify load order file"),
      );
  };
};

export const onProfileWillChange = (api: types.IExtensionApi) => {
  return async (profileId: string) => {
    const state = api.getState();
    const profile = selectors.profileById(state, profileId);
    if (profile?.gameId !== GAME_ID) {
      return;
    }

    const lastProfId = selectors.lastActiveProfileForGame(state, profile.gameId);
    try {
      await storeToProfile(api, lastProfId).then(() => restoreFromProfile(api, profile.id));
    } catch (err) {
      if (!(err instanceof util.UserCanceled)) {
        api.showErrorNotification("Failed to store profile specific merged items", err);
      }
    }
  };
};

function getScriptMergerTool(api) {
  const state = api.store.getState();
  const scriptMerger = util.getSafe(
    state,
    ["settings", "gameMode", "discovered", GAME_ID, "tools", SCRIPT_MERGER_ID],
    undefined,
  );
  if (!!scriptMerger?.path) {
    return scriptMerger;
  }

  return undefined;
}

/**
 * The remaster ships its vanilla scripts as UTF-8 where every earlier release
 * used UTF-16, and the merger was built against the old encoding, so merging
 * can write corrupted scripts into the merged mod.
 */
async function confirmMergerOnRemaster(api: types.IExtensionApi): Promise<boolean> {
  const discovery = selectors.discoveryByGame(api.getState(), GAME_ID);
  if (detectEdition(discovery?.path) !== W3Edition.Remastered) {
    return true;
  }

  const result = await api.showDialog(
    "info",
    "Script Merger and the Remastered edition",
    {
      text:
        "The Remastered edition stores its scripts in a different text encoding to earlier " +
        "releases, and mods that need merging were generally built against the old one. " +
        "Merging them may produce corrupted scripts.\n\n" +
        "Mods written for the Remastered edition merge themselves and do not need this tool.",
    },
    [{ label: "Cancel" }, { label: "Run anyway", default: true }],
    "w3-merger-remastered-warning",
  );
  return result.action === "Run anyway";
}

async function runScriptMerger(api) {
  const tool = getScriptMergerTool(api);
  if (tool?.path === undefined) {
    // The user asked for the merger explicitly, so say it's missing even on
    // editions we otherwise stay quiet about.
    notifyMissingScriptMerger(api, true);
    return Promise.resolve();
  }

  if (!(await confirmMergerOnRemaster(api))) {
    return Promise.resolve();
  }

  return api.runExecutable(tool.path, [], { suggestDeploy: true }).catch((err) =>
    api.showErrorNotification("Failed to run tool", err, {
      allowReport: ["EPERM", "EACCESS", "ENOENT"].indexOf(err.code) !== -1,
    }),
  );
}

function queryScriptMerge(api: types.IExtensionApi, reason: string) {
  const state = api.store.getState();
  const t = api.translate;
  if ((state.session.base.activity?.installing_dependencies ?? []).length > 0) {
    // Do not bug users while they're installing a collection.
    return;
  }
  if (!shouldNotifyMissingScriptMerger(api)) {
    // Nothing to merge until two mods ship whole-file scripts.
    return;
  }
  const scriptMergerTool = util.getSafe(
    state,
    ["settings", "gameMode", "discovered", GAME_ID, "tools", SCRIPT_MERGER_ID],
    undefined,
  );
  if (!!scriptMergerTool?.path) {
    api.sendNotification({
      id: "witcher3-merge",
      type: "warning",
      message: t("Witcher Script merger may need to be executed", { ns: I18N_NAMESPACE }),
      allowSuppress: true,
      actions: [
        {
          title: "More",
          action: () => {
            api.showDialog(
              "info",
              "Witcher 3",
              {
                text: reason,
              },
              [{ label: "Close" }],
            );
          },
        },
        {
          title: "Run tool",
          action: (dismiss) => {
            runScriptMerger(api);
            dismiss();
          },
        },
      ],
    });
  } else {
    notifyMissingScriptMerger(api);
  }
}
