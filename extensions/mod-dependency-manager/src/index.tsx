/* eslint-disable */
/*
 * Extension for editing and visualising mod dependencies
 */

import { IBiDirRule } from "./types/IBiDirRule";
import { IConflict } from "./types/IConflict";
import { IModLookupInfo } from "./types/IModLookupInfo";
import determineConflicts from "./util/conflicts";
import DependenciesFilter from "./util/DependenciesFilter";
import { findRuleBiDir, isConflictResolved } from "./util/findRule";
import renderModLookup from "./util/renderModLookup";
import ruleFulfilled from "./util/ruleFulfilled";
import showUnsolvedConflictsDialog from "./util/showUnsolvedConflicts";
import { topologicalSort } from "./util/topologicalSort";
import ConflictEditor from "./views/ConflictEditor";
import ConflictGraph from "./views/ConflictGraph";
import Connector from "./views/Connector";
import DependencyIcon, { ILocalState } from "./views/DependencyIcon";
import Editor from "./views/Editor";
import ModNameWrapper from "./views/ModNameWrapper";
import OverrideEditor, { IPathTools } from "./views/OverrideEditor";
import Settings from "./views/Settings";

import {
  setConflictDialog,
  setConflictInfo,
  setEditCycle,
  setFileOverrideDialog,
  setHasUnsolvedConflicts,
  setModTypeConflictsSetting,
} from "./actions";
import {
  sessionReducer as connectionReducer,
  settingsReducer,
} from "./reducers";
import {
  enabledModKeys,
  enabledModsWithOverrides,
  modsWithOverrides,
} from "./selectors";
import unsolvedConflictsCheck from "./unsolvedConflictsCheck";

import { disableModTypeConflictsDialog } from "./util/disableModTypeConflicts";

import Bluebird from "bluebird";
import I18next, { WithT } from "i18next";
import * as _ from "lodash";
import {
  ILookupResult,
  IModInfo,
  IReference,
  IRule,
  RuleType,
} from "modmeta-db";
import * as path from "path";
import * as React from "react";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import * as Redux from "redux";
import {} from "redux-thunk";
import shortid = require("shortid");
import {
  actions,
  fs,
  log,
  PureComponentEx,
  selectors,
  ToolbarIcon,
  types,
  util,
} from "vortex-api";

const CONFLICT_NOTIFICATION_ID = "mod-file-conflict";
const UNFULFILLED_NOTIFICATION_ID = "mod-rule-unfulfilled";

function makeReference(mod: IModInfo): IReference {
  return {
    fileExpression:
      mod.fileName !== undefined
        ? path.basename(mod.fileName, path.extname(mod.fileName))
        : undefined,
    fileMD5: mod.fileMD5,
    versionMatch: mod.fileVersion,
    logicalFileName: mod.logicalFileName,
  };
}

function inverseRule(ruleType: RuleType): RuleType {
  switch (ruleType) {
    case "before":
      return "after";
    case "after":
      return "before";
    case "conflicts":
      return "conflicts";
    default:
      throw new Error("unsupported rule " + ruleType);
  }
}
const validRuleTypes: RuleType[] = [
  "before",
  "after",
  "conflicts",
  "requires",
  "recommends",
  "provides",
];
function mapRules(source: IReference, rules: IRule[]): IBiDirRule[] {
  const res: IBiDirRule[] = [];
  if (rules === undefined) {
    return res;
  }
  rules.forEach((rule) => {
    if (!validRuleTypes.includes(rule?.type)) {
      log("warn", "unsupported rule type", rule);
      return;
    }
    if (["requires", "recommends", "provides"].indexOf(rule.type) !== -1) {
      return;
    }
    res.push({
      source,
      type: rule.type,
      reference: rule.reference,
      original: true,
    });
    try {
      const inverseRuleType = inverseRule(rule.type);
      res.push({
        source: rule.reference,
        type: inverseRuleType,
        reference: source,
        original: false,
      });
    } catch (err) {
      log("warn", "failed to create reverse rule", err);
    }
  });
  return res;
}

function updateMetaRules(
  api: types.IExtensionApi,
  gameId: string,
  mods: { [modId: string]: types.IMod },
): Bluebird<IBiDirRule[]> {
  let rules: IBiDirRule[] = [];
  return Bluebird.map(Object.keys(mods || {}), (modId) => {
    const mod = mods[modId];
    if (mod.attributes === undefined) {
      return;
    }
    const ref = (util as any).makeModReference(mod);
    if (
      ref.fileExpression === undefined &&
      ref.fileMD5 === undefined &&
      ref.logicalFileName === undefined
    ) {
      return;
    }
    // Include the mod id so that testModReference can match this reference
    // back to its mod even when file-based attributes are incomplete
    ref.id = modId;
    rules = rules.concat(mapRules(ref, mod.rules));
    let downloadGame = mod.attributes["downloadGame"] || gameId;
    if (Array.isArray(downloadGame)) {
      downloadGame = downloadGame[0];
    }

    const state = api.store.getState();
    const downloadPath = selectors.downloadPathForGame(state, downloadGame);
    const fileName = mod.attributes?.fileName;
    const filePath =
      fileName !== undefined ? path.join(downloadPath, fileName) : undefined;

    return api
      .lookupModMeta({
        fileMD5: mod.attributes?.fileMD5,
        fileSize: mod.attributes?.fileSize,
        filePath,
        gameId: downloadGame,
      })
      .then((meta: ILookupResult[]) => {
        if (meta.length > 0 && meta[0].value !== undefined) {
          rules = rules.concat(
            mapRules(makeReference(meta[0].value), meta[0].value.rules),
          );
          if (mod.attributes?.fileMD5 === undefined) {
            api.store.dispatch(
              actions.setModAttribute(
                gameId,
                mod.id,
                "fileMD5",
                meta[0].value.fileMD5,
              ),
            );
          }
        }
      })
      .catch((err: Error) => {
        log("warn", "failed to look up mod", {
          err: err.message,
          stack: err.stack,
        });
      });
  }).then(() => rules);
}

function findOverridenByFile(
  conflicts: IConflict[],
  mods: types.IMod[],
  fileName: string,
): types.IMod[] {
  // The redundancy check would have ensured that the file exists in the staging folder.
  const res: types.IMod[] = [];
  const relevantConflicts = conflicts.filter((c) => c.files.includes(fileName));
  const relevantMods = mods.filter(
    (m) =>
      (m.fileOverrides !== undefined && m.fileOverrides.includes(fileName)) ||
      relevantConflicts.some((c) => c.otherMod.id === m.id),
  );
  res.push(...relevantMods);
  return res;
}

const hasOverrides = (mod: types.IMod) =>
  mod?.fileOverrides !== undefined && mod.fileOverrides.length > 0;
const hasSameModType = (lhs: types.IMod, rhs: types.IMod) =>
  lhs.type === rhs.type;
const purgeSingleMod = (
  api: types.IExtensionApi,
  gameMode: string,
  modId: string,
) => api.emitAndAwait("deploy-single-mod", gameMode, modId, false);
const purgeModList = (
  api: types.IExtensionApi,
  modIds: string[],
  gameMode: string,
) =>
  new Promise<void>(async (resolve, reject) => {
    for (const modId of modIds) {
      await purgeSingleMod(api, gameMode, modId).catch((err) => reject(err));
    }
    return resolve();
  });
const purgeAllMods = (api: types.IExtensionApi) =>
  new Promise<void>((resolve, reject) => {
    api.events.emit("purge-mods", false, (err) =>
      err !== null ? reject(err) : resolve(),
    );
  });

type OverrideByMod = { [modId: string]: string[] };
type ModsTable = { [modId: string]: types.IMod };

function addFileOverrides(api: types.IExtensionApi) {
  const state = api.getState();
  const gameId = selectors.activeGameId(state);
  const mods = state?.persistent?.mods?.[gameId];
  const knownConflicts = state?.session?.["dependencies"]?.conflicts;
  const enabled: ModsTable = enabledModKeys(state).reduce((accum, mod) => {
    if (!!mods[mod?.id]) {
      accum[mod.id] = mods[mod.id];
    }
    return accum;
  }, {});
  const batchedActions = [];
  const addOverrides = (modId: string, conflict: IConflict) => {
    const lhs = enabled[modId];
    const rhs = enabled[conflict.otherMod.id];
    if (lhs === undefined || rhs === undefined) {
      return;
    }
    if (!hasSameModType(lhs, rhs)) {
      batchedActions.push(
        actions.setFileOverride(gameId, modId, conflict.files),
      );
      batchedActions.push(
        actions.setFileOverride(gameId, conflict.otherMod.id, conflict.files),
      );
    }
  };

  for (const modId of Object.keys(enabled)) {
    const conflicts = knownConflicts?.[modId];
    if (conflicts === undefined) {
      continue;
    }
    for (const conflict of conflicts) {
      if (
        !hasOverrides(enabled[modId]) &&
        !hasOverrides(enabled[conflict.otherMod.id])
      ) {
        addOverrides(modId, conflict);
      }
    }
  }

  if (batchedActions.length > 0) {
    util.batchDispatch(api.store, batchedActions);
  }
}

async function updateOverrides(
  api: types.IExtensionApi,
  startTime: number,
  batched: Redux.Action[],
): Promise<void> {
  // Make sure this never gets called before the rules had a chance to calculate.
  const state = api.store.getState();
  const gameMode = selectors.activeGameId(state);
  const mods: ModsTable = state.persistent.mods?.[gameMode];
  const knownConflicts: { [modId: string]: IConflict[] } =
    state?.session?.["dependencies"]?.conflicts;
  if (!gameMode || !mods) {
    // No active game/no mods.
    return;
  }

  const ensureUnique = (arr: string[]) => Array.from(new Set(arr));
  const enabledKeys = enabledModKeys(state).map((m) => m.id);
  const toAction = (modId: string, fileOverrides: string[]) =>
    actions.setFileOverride(gameMode, modId, fileOverrides);
  const enabled = enabledModsWithOverrides(state) ?? [];
  const overrideActions = [];
  const solved = new Set<string>();
  const types = new Set<string>();
  let batchedActions: Redux.Action[] = batched || [];
  const overrideChanges: OverrideByMod = enabled.reduce((accum, mod) => {
    types.add(mod.type);
    const modId = mod.id;
    const conflicts = (knownConflicts?.[modId] ?? []).filter((c) =>
      enabledKeys.includes(c.otherMod.id),
    );
    if (conflicts.length === 0) {
      // This mod doesn't have any known conflicts, make sure it has no overrides either.
      accum[modId] = [];
      return accum;
    }

    const modOverrides = mod.fileOverrides || [];
    const invalidOverrides: string[] = modOverrides.reduce((accum, o) => {
      const hasConflict = conflicts.some((c) => c.files.includes(o));
      const canFileDeploy = conflicts
        .filter((c) => c.files.includes(o))
        .some((c) => {
          const otherMod = enabled.find((m) => m.id === c.otherMod.id);
          return !otherMod?.fileOverrides?.includes(o);
        });
      if (!hasConflict || !canFileDeploy) {
        accum.push(o);
      }
      return accum;
    }, []);
    const invalidBatched = toAction(
      modId,
      modOverrides.filter((o) => !invalidOverrides.includes(o)),
    );
    batchedActions = !!batchedActions
      ? [].concat([invalidBatched], batchedActions)
      : [invalidBatched];
    for (const conflict of conflicts) {
      for (const fileName of conflict.files) {
        if (solved.has(fileName)) {
          continue;
        }
        const conflicting = findOverridenByFile(
          conflicts,
          Object.values(enabled),
          fileName,
        );

        // Check if the file is being deployed by any of the other mods in the conflict.
        const isDeploying =
          conflicting.length > 1
            ? conflicting.find((c) =>
                (c.fileOverrides ?? []).includes(fileName),
              ) === undefined
            : true;

        if (conflicting.length === 1 && !isDeploying) {
          // None of the conflicting mods have this file override. no point in keeping the override for this file!
          const overrides = (mod.fileOverrides || []).filter(
            (over) => over !== fileName,
          );
          accum[modId] = ensureUnique(overrides);
          solved.add(fileName);
          continue;
        }

        // This file conflict is not resolved, we're going to use the mod rules
        //  to decide which mod should deploy the file.
        const sorted = topologicalSort(conflicting);
        const top = sorted[0];
        solved.add(fileName);

        // Ensure the top mod has no override for this file.
        accum[top] = ensureUnique(accum[top] || mod.fileOverrides).filter(
          (over) => over !== fileName,
        );
        for (const iter of sorted.slice(1)) {
          // All other mods should have this file override.
          const overrides = (
            accum[iter] ||
            (mods[iter]?.fileOverrides ?? [])
          ).concat(fileName);
          accum[iter] = ensureUnique(overrides);
        }
      }
    }
    return accum;
  }, {});

  if (Object.keys(overrideChanges).length > 0) {
    for (const [modId, overrides] of Object.entries(overrideChanges)) {
      overrideActions.push(actions.setFileOverride(gameMode, modId, overrides));
    }
  }
  if (overrideActions.length === 0 && !batchedActions) {
    return;
  }

  log("info", "starting purge activity to update overrides");
  // Bit of stats/info when calculating purge ratio:
  //  When purging ~700 mods, purging all the mods will usually take ~30 seconds on an average machine.
  //  Purging a single mod will usually take ~6 seconds as it still needs to parse the deployment manifest,
  //  700 * 0.05 = 35 mods * 6 seconds = 210 seconds.
  // Overall this could be a nice fast operation if we're only purging a few mods, but as long as we
  //  pull the full deployment manifest for a specified modType, this will never be optimal; might as well
  //  just purge everything.
  // const ratio = enabled.length / Object.keys(enabledModKeys(state)).length;
  // return (ratio > 0.05 ? purgeAllMods(api) : purgeModList(api, enabled.map(mod => mod.id), gameMode))
  return (types.size > 1 ? purgeAllMods(api) : Promise.resolve()).then(() => {
    if (!!batchedActions && batchedActions.length > 0) {
      overrideActions.push(...batchedActions);
    }

    if (overrideActions.length > 0) {
      util.batchDispatch(api.store, overrideActions);
    }
    const purgeEndTime = new Date().getTime();
    const elapsedPurgeTime = (purgeEndTime - startTime) / 1000;
    log("info", `finished purge activity in ${elapsedPurgeTime} seconds`);
    return Promise.resolve();
  });
}

function removeFileOverrideRedundancies(
  api: types.IExtensionApi,
  gameMode: string,
  data: { [modId: string]: string[] },
) {
  // We expect that any of the filePaths included in the provided data object to have been
  //  _confirmed_ to be removed before calling this function!!!
  const state = api.store.getState();
  if (!data || Object.keys(data).length === 0) {
    return;
  }
  const mods: { [modId: string]: types.IMod } = util.getSafe(
    state,
    ["persistent", "mods", gameMode],
    {},
  );
  const modsWithRedundancies = (modsWithOverrides(state) ?? []).filter(
    (mod) =>
      (mod?.fileOverrides ?? []).find((filePath) =>
        (data?.[mod.id] ?? []).includes(filePath),
      ) !== undefined,
  );
  const batchedActions = modsWithRedundancies.reduce((accum, iter) => {
    const currentFileOverrides = mods[iter.id]?.fileOverrides || [];
    const removedFiles = data[iter.id] ?? [];
    const newOverrides = currentFileOverrides.filter(
      (over) => !removedFiles.includes(over),
    );
    accum.push(actions.setFileOverride(gameMode, iter.id, newOverrides));
    return accum;
  }, []);

  util.batchDispatch(api.store, batchedActions);
}

const dependencyState = util.makeReactive<ILocalState>({
  modRules: [],
});

interface ILoadOrderState {
  [id: string]: number;
}

let loadOrder: ILoadOrderState = {};
let loadOrderChanged: () => void = () => undefined;
let dependenciesChanged: () => void = () => undefined;

async function updateConflictInfo(
  api: types.IExtensionApi,
  gameId: string,
  conflicts: { [modId: string]: IConflict[] },
) {
  const t: typeof I18next.t = api.translate;
  const store: any = api.store;

  const mods = store.getState().persistent.mods[gameId];
  const unsolved: { [modId: string]: IConflict[] } = {};

  if (mods === undefined) {
    // normal before the first mod for a game is installed
    store.dispatch(actions.dismissNotification(CONFLICT_NOTIFICATION_ID));
    return;
  }

  const encountered = new Set<string>();
  const mapEnc = (lhs: string, rhs: string) => [lhs, rhs].sort().join(":");

  // see if there is a mod that has conflicts for which there are no rules
  Object.keys(conflicts).forEach((modId) => {
    const filtered = conflicts[modId].filter((conflict) => {
      const encKey = mapEnc(modId, conflict.otherMod.id);
      if (encountered.has(encKey)) {
        return false;
      }
      encountered.add(encKey);
      return (
        !isConflictResolved(mods, modId, conflict.otherMod) &&
        findRuleBiDir(
          dependencyState.modRules,
          mods[modId],
          conflict.otherMod,
        ) === undefined
      );
    });

    if (filtered.length !== 0) {
      unsolved[modId] = filtered;
    }
  });

  if (Object.keys(unsolved).length === 0) {
    store.dispatch(actions.dismissNotification(CONFLICT_NOTIFICATION_ID));
    store.dispatch(setHasUnsolvedConflicts(false));
  } else {
    const message: string[] = [
      t(
        "There are unresolved file conflicts. This just means that two or more mods contain the " +
          "same files and you need to decide which of them loads last and thus provides " +
          "the files.\n",
      ),
      "[table][tbody]",
    ].concat(
      Object.keys(unsolved).map(
        (modId) =>
          "[tr]" +
          t(
            "[td]{{modName}}[/td]" +
              '[td][color="red"][svg]conflict[/svg][/color][/td]' +
              "[td][list]{{conflicts}}[/list][/td][/tr]",
            {
              replace: {
                modName: util.renderModName(mods[modId]),
                conflicts: unsolved[modId].map(
                  (conflict) => "[*] " + renderModLookup(conflict.otherMod),
                ),
              },
            },
          ),
      ),
      "[/tbody][/table]",
    );
    const showDetails = () => {
      store.dispatch(
        actions.showDialog(
          "info",
          t("Unresolved file conflicts"),
          {
            bbcode: message.join("\n"),
            options: { translated: true, wrap: true },
          },
          [
            { label: "Close" },
            {
              label: "Show",
              action: () => {
                showUnsolvedConflictsDialog(
                  api,
                  dependencyState.modRules,
                  undefined,
                  gameId,
                );
              },
            },
          ],
        ),
      );
    };

    store.dispatch(setHasUnsolvedConflicts(true));
    store.dispatch(
      actions.addNotification({
        type: "warning",
        message: "There are unresolved file conflicts",
        id: CONFLICT_NOTIFICATION_ID,
        noDismiss: true,
        actions: [
          {
            title: "More",
            action: showDetails,
          },
        ],
      }),
    );
  }
}

function renderRuleType(t: typeof I18next.t, type: RuleType): string {
  switch (type) {
    case "conflicts":
      return t("conflicts with");
    case "requires":
      return t("requires");
    default:
      return "unknown";
  }
}

function checkRulesFulfilled(api: types.IExtensionApi): Bluebird<void> {
  const t = api.translate;
  const store: any = api.store;
  const state = store.getState();
  const enabledMods: IModLookupInfo[] = enabledModKeys(state);
  const activeProfile = selectors.activeProfile(state);
  if (activeProfile === undefined) {
    return Bluebird.resolve();
  }
  const gameMode = activeProfile.gameId;
  const mods = state.persistent.mods[gameMode];

  return Bluebird.map(enabledMods, (modLookup) => {
    const mod: types.IMod = mods[modLookup.id];

    let downloadGame = util.getSafe(mod.attributes, ["downloadGame"], gameMode);
    if (Array.isArray(downloadGame)) {
      downloadGame = downloadGame[0];
    }

    const downloadPath = selectors.downloadPathForGame(state, downloadGame);
    const fileName = mod.attributes?.fileName;
    const filePath =
      fileName !== undefined ? path.join(downloadPath, fileName) : undefined;

    return api
      .lookupModMeta({
        fileMD5: mod.attributes?.fileMD5,
        fileSize: mod.attributes?.fileSize,
        filePath,
        gameId: downloadGame,
      })
      .then((meta: ILookupResult[]) => {
        if (meta.length > 0 && mod.attributes?.fileMD5 === undefined) {
          api.store.dispatch(
            actions.setModAttribute(
              gameMode,
              mod.id,
              "fileMD5",
              meta[0].value.fileMD5,
            ),
          );
        }
        // get both the rules from the meta server and the ones stored with the mod
        const rules: IRule[] = [].concat(
          meta.length > 0 && meta[0].value !== undefined
            ? meta[0].value.rules || []
            : [],
          util.getSafe(mods[modLookup.id], ["rules"], []),
        );
        const rulesUnfulfilled = rules.filter(
          (rule) =>
            ruleFulfilled(enabledMods, rule, {
              gameId: gameMode,
              modId: mod.id,
            }) === false,
        );
        const res: { modId: string; rules: IRule[] } =
          rulesUnfulfilled.length === 0
            ? null
            : {
                modId: mod.id,
                rules: rulesUnfulfilled,
              };

        if (
          mod.attributes?.fileMD5 === undefined &&
          meta?.[0]?.value !== undefined
        ) {
          store.dispatch(
            actions.setModAttribute(
              gameMode,
              mod.id,
              "fileMD5",
              meta[0].value.fileMD5,
            ),
          );
        }

        return Promise.resolve(res);
      });
  })
    .then((unfulfilled: Array<{ modId: string; rules: types.IModRule[] }>) => {
      // allow anyone else handle this to give more specific notifications, e.g.
      // based on mod type
      return Bluebird.map(
        unfulfilled.filter((iter) => iter !== null),
        (iter) =>
          api
            .emitAndAwait(
              "unfulfilled-rules",
              activeProfile.id,
              iter.modId,
              iter.rules,
            )
            .then((result: boolean[]) =>
              Promise.resolve(result[0] ? undefined : iter),
            ),
      ).filter((iter) => iter !== undefined);
    })
    .then((unfulfilled: Array<{ modId: string; rules: types.IModRule[] }>) => {
      const modsUnfulfilled = unfulfilled.filter((iter) => iter !== null);

      if (modsUnfulfilled.length === 0) {
        store.dispatch(
          actions.dismissNotification(UNFULFILLED_NOTIFICATION_ID),
        );
      } else {
        const hasRequired: Set<string> = new Set([]);

        const message: string[] = [
          t("There are mod dependency rules that aren't fulfilled."),
          "[list]",
        ]
          .concat(
            modsUnfulfilled.map((iter) =>
              iter.rules
                .map((rule: types.IModRule) => {
                  const modName = util.renderModName(mods[iter.modId]);
                  if (rule.type === "requires") {
                    hasRequired.add(iter.modId);
                  }
                  const type = renderRuleType(t, rule.type);
                  const other = (util as any).renderModReference(
                    rule.reference,
                    mods[rule.reference.id],
                  );
                  return `[*] "${modName}" ${type} "${other}"`;
                })
                .join("<br/>"),
            ),
          )
          .concat(["[/list]"]);

        const showDetails = () => {
          const dialogActions: types.IDialogAction[] = [{ label: "Close" }];

          if (hasRequired.size > 0) {
            dialogActions.push({
              label: "Install Dependencies",
              action: () => {
                api.events.emit(
                  "install-dependencies",
                  activeProfile?.id,
                  gameMode,
                  Array.from(hasRequired),
                );
              },
            });
          }

          store.dispatch(
            actions.showDialog(
              "info",
              t("Unresolved mod conflicts or requirements"),
              {
                bbcode: message.join("<br/>"),
                options: { translated: true, wrap: true },
              },
              dialogActions,
            ),
          );
        };

        store.dispatch(
          actions.addNotification({
            type: "warning",
            message: "Some mod dependencies are not fulfilled",
            id: UNFULFILLED_NOTIFICATION_ID,
            noDismiss: true,
            actions: [
              {
                title: "More",
                action: showDetails,
              },
            ],
          }),
        );
      }
    });
}

const shouldSuppressUpdate = (api: types.IExtensionApi) => {
  const state = api.getState();
  const suppressOnActivities = [
    "conflicts",
    "installing_dependencies",
    "deployment",
    "purging",
  ];
  const isActivityRunning = (activity: string) =>
    util
      .getSafe(state, ["session", "base", "activity", "mods"], [])
      .includes(activity) || // purge/deploy
    util.getSafe(state, ["session", "base", "activity", activity], []).length >
      0; // installing_dependencies
  const suppressingActivities = suppressOnActivities.filter((activity) =>
    isActivityRunning(activity),
  );
  const suppressing = suppressingActivities.length > 0;
  if (suppressing) {
    log("info", "skipping conflict/override checks during activities", {
      activities: suppressingActivities,
    });
  }
  return suppressing;
};

// determine all conflicts and check if they are fulfilled or not
function checkConflictsAndRules(api: types.IExtensionApi): Promise<void> {
  const state = api.getState();
  const stagingPath = selectors.installPath(state);
  const gameMode = selectors.activeGameId(state);
  log("debug", "check conflicts and rules", { gameMode });
  if (gameMode === undefined) {
    return Promise.resolve();
  }

  const game = util.getGame(gameMode);
  if (game === undefined || game.mergeMods === false) {
    // in the case mergeMods === false, conflicts aren't possible because
    // each mod is deployed into a unique subdirectory.
    // we did *not* forget the case where mergeMods is a function!
    // If mergeMods is a function we don't expect conflicts but they are
    // technically possible if the name generated by mergeMods isn't unique.
    return Promise.resolve();
  }

  const discovery = selectors.currentGameDiscovery(state);
  if (discovery === undefined || discovery.path === undefined) {
    return Promise.resolve();
  }

  const modState = selectors.activeProfile(state).modState;
  const gameMods = state.persistent.mods[gameMode] ?? {};
  const mods = Object.keys(gameMods)
    .filter((modId) => util.getSafe(modState, [modId, "enabled"], false))
    .filter(
      (modId) =>
        util.getModType(gameMods[modId].type)?.options?.["noConflicts"] !==
        true,
    )
    .map((modId) => state.persistent.mods[gameMode][modId]);
  const activator = util.getCurrentActivator(state, gameMode, true);

  api.store.dispatch(actions.startActivity("mods", "conflicts"));
  return determineConflicts(api, game, stagingPath, mods, activator)
    .then((conflictMap) => {
      if (!_.isEqual(conflictMap, state.session["dependencies"].conflicts)) {
        api.store.dispatch(setConflictInfo(conflictMap));
      }
      updateConflictInfo(api, gameMode, conflictMap);
      return checkRulesFulfilled(api);
    })
    .catch((err) => {
      // 1392 means that the file/folder is corrupt/unreadable
      // 433 means that the storage device is not connected
      // Each are user hardware/environment issues which we can
      //  do nothing about.
      const allowReport = ![1392, 433].includes(err?.systemCode);
      api.showErrorNotification("Failed to determine conflicts", err, {
        allowReport,
      });
    });
}

function checkRedundantFileOverrides(api: types.IExtensionApi) {
  // This test intends to remove a mod's defined fileOverrides
  //  for file entries that no longer exist inside the mod's staging folder.
  //  e.g. https://github.com/Nexus-Mods/Vortex/issues/9671 where the user
  //  is manually removing files from the staging folder.
  return () =>
    new Bluebird<types.ITestResult>((resolve, reject) => {
      const state = api.store.getState();
      const gameId = selectors.activeGameId(state);
      const discovery = selectors.discoveryByGame(state, gameId);
      if (discovery?.path === undefined) {
        return resolve(undefined);
      }
      const modsWithFileOverrides = enabledModsWithOverrides(state) ?? [];
      if (modsWithFileOverrides.length === 0) {
        return resolve(undefined);
      }

      const fileExists = (filePath: string) =>
        fs
          .statAsync(filePath)
          .then(() => Bluebird.resolve(true))
          .catch((err) =>
            err.code !== "ENOENT"
              ? Bluebird.resolve(true)
              : Bluebird.resolve(false),
          );

      const game: types.IGame = util.getGame(gameId);
      const modPaths = game.getModPaths(discovery.path);
      return Bluebird.reduce(
        modsWithFileOverrides,
        (accum, iter) => {
          if (iter?.installationPath === undefined) {
            // The state has changed since this test executed (yes it can happen); if the mod is no longer
            //  installed, we can just jump to the next mod id.
            return accum;
          }
          const deployPath = modPaths[iter.type];
          if (deployPath === undefined) {
            return accum;
          }
          const missing: string[] = [];
          const stagingFolder = selectors.installPathForGame(state, gameId);
          const modInstallationPath = iter.installationPath;
          const modPath = path.join(stagingFolder, modInstallationPath);
          const filePaths = iter.fileOverrides.map((file) => {
            const relPath = path.relative(deployPath, file);
            return { rel: relPath, abs: path.join(modPath, relPath) };
          });
          return Bluebird.each(filePaths, (filePath) =>
            fileExists(filePath.abs).then((res) => {
              if (res === false) {
                missing.push(filePath.abs);
              }
            }),
          ).then(() => {
            if (missing.length > 0) {
              accum[iter.id] = missing;
            }
            return Promise.resolve(accum);
          });
        },
        {},
      )
        .then((redundant) => {
          removeFileOverrideRedundancies(api, gameId, redundant);
          return Promise.resolve();
        })
        .finally(() => resolve(undefined));
    });
}

function showCycles(
  api: types.IExtensionApi,
  cycles: string[][],
  gameId: string,
) {
  const state: types.IState = api.store.getState();
  const mods = state.persistent.mods[gameId];
  const id = shortid();
  api.showDialog(
    "error",
    "Cycles",
    {
      text:
        "Dependency rules between your mods contain cycles, " +
        'like "A after B" and "B after A". You need to remove one of the ' +
        "rules causing the cycle, otherwise your mods can't be " +
        "applied in the right order.",
      links: cycles.map((cycle, idx) => ({
        label: cycle
          .map((modId) =>
            mods[modId] !== undefined ? util.renderModName(mods[modId]) : modId,
          )
          .map((name) => `[${name}]`)
          .join(" --> "),
        action: () => {
          api.closeDialog(id);
          api.store.dispatch(setEditCycle(gameId, cycle));
        },
      })),
    },
    [{ label: "Close" }],
    id,
  );
}

function updateCycles(api: types.IExtensionApi, cycles: string[][]) {
  const state = api.store.getState();
  if (state.session.dependencies.editCycle !== undefined) {
    // if we're already showing a cycle, update it if necessary
    const displayed = new Set<string>(
      state.session.dependencies.editCycle.modIds,
    );
    // there could be multiple clusters so we have to find the one that corresponds
    // to the one being shown currently, it should be sufficient to find the cycle that
    // has one mod in common with the one being displayed.
    const update = cycles.find(
      (cycle) => cycle.find((modId) => displayed.has(modId)) !== undefined,
    );
    const gameId = selectors.activeGameId(state);
    api.store.dispatch(
      setEditCycle(update !== undefined ? gameId : undefined, update),
    );
  }
}

function generateLoadOrder(api: types.IExtensionApi): Bluebird<void> {
  const store = api.store;
  const gameMode = selectors.activeGameId(store.getState());
  const state: types.IState = store.getState();
  const gameMods = state.persistent.mods[gameMode] || {};
  const profile = selectors.activeProfile(state);
  const mods = Object.keys(gameMods)
    .filter((key) => util.getSafe(profile, ["modState", key, "enabled"], false))
    .map((key) => gameMods[key]);
  return util
    .sortMods(gameMode, mods, api)
    .then((sorted) => {
      // no error in sorting? Close cycle editor if it's open
      const newState = api.store.getState();
      if (newState.session.dependencies.editCycle !== undefined) {
        api.store.dispatch(setEditCycle(undefined, undefined));
      }
      return Promise.resolve(sorted);
    })
    .catch(util.CycleError, (err) => {
      updateCycles(api, err.cycles);
      api.sendNotification({
        id: "mod-cycle-warning",
        type: "warning",
        message: "Mod rules contain cycles",
        noDismiss: true,
        actions: [
          {
            title: "Show",
            action: () => {
              showCycles(api, err.cycles, gameMode);
            },
          },
        ],
      });
      // return unsorted
      return Promise.resolve(mods);
    })
    .then((sortedMods: types.IMod[]) => {
      loadOrder = sortedMods
        .filter((mod: types.IMod) =>
          util.getSafe(profile.modState, [mod.id, "enabled"], false),
        )
        .reduce(
          (prev: { [id: string]: number }, mod: types.IMod, idx: number) => {
            prev[mod.id] = idx;
            return prev;
          },
          {},
        );
      loadOrderChanged();
    })
    .catch(util.CycleError, () => {
      api.sendNotification({
        id: "sorting-mods-failed",
        type: "warning",
        title: "Sorting mods failed",
        message: "Rules contain cycles",
        displayMS: 5000,
      });
    });
}

function changeMayAffectOverrides(
  before: types.IMod,
  after: types.IMod,
): boolean {
  const overrideSort = (mod: types.IMod) =>
    mod.fileOverrides !== undefined ? [...mod.fileOverrides].sort() : [];
  if (
    before === undefined ||
    before?.type !== after?.type ||
    (before.rules !== undefined) !== (after.rules !== undefined) ||
    !_.isEqual(overrideSort(before), overrideSort(after))
  ) {
    return true;
  }
  return false;
}

function changeMayAffectRules(before: types.IMod, after: types.IMod): boolean {
  // if the mod is new or if it previously had no attributes and now has them,
  // this could affect the rules, if it had no rules before and now has them,
  // that most definitively affects rules

  if (
    before === undefined ||
    before?.type !== after?.type ||
    (before.attributes !== undefined) !== (after.attributes !== undefined) ||
    (before.rules !== undefined) !== (after.rules !== undefined)
  ) {
    return true;
  }

  if (after.attributes === undefined) {
    return false;
  }

  return (
    before.rules !== after.rules ||
    before.attributes["version"] !== after.attributes["version"]
  );
}

function makeLoadOrderAttribute(
  api: types.IExtensionApi,
): types.ITableAttribute<types.IMod> {
  return {
    id: "loadOrder",
    name: "Deploy Order",
    description: "Deploy order derived from mod dependencies",
    icon: "order",
    placement: "table",
    isToggleable: true,
    isSortable: true,
    isDefaultVisible: false,
    calc: (mod: types.IMod) => loadOrder[mod.id],
    condition: () => {
      const gameMode = selectors.activeGameId(api.store.getState());
      // if mergeMods is a function we could still actually get file conflicts, because
      // it's then not guaranteed that the mod path is unique
      return util.getGame(gameMode).mergeMods !== false;
    },
    edit: {},
    externalData: (onChange: () => void) => {
      loadOrderChanged = onChange;
    },
  };
}

function makeDependenciesAttribute(
  api: types.IExtensionApi,
): types.ITableAttribute<types.IMod> {
  const res: types.ITableAttribute<types.IMod> = {
    id: "dependencies",
    name: "Dependencies",
    description: "Relations to other mods",
    icon: "plug",
    placement: "table",
    customRenderer: (mod, detailCell, t, props) => (
      <DependencyIcon
        mod={Array.isArray(mod) ? mod[0] : mod}
        t={t}
        localState={dependencyState}
        onHighlight={props.onHighlight}
      />
    ),
    condition: () => {
      const gameMode = selectors.activeGameId(api.store.getState());
      return util.getGame(gameMode).mergeMods !== false;
    },
    calc: (mod: types.IMod) => mod,
    isToggleable: true,
    isDefaultVisible: false,
    externalData: (onChange: () => void) => {
      dependenciesChanged = onChange;
    },
    edit: {},
    isSortable: true,
    isVolatile: true,
    sortFuncRaw: (lhs, rhs, locale) => {
      const filter =
        api.getState().settings.tables["mods"].filter?.["dependencies"] ?? [];

      if (filter.length >= 2 && filter[0] === "depends") {
        if (filter[1] === lhs.id) {
          return -1;
        } else if (filter[1] === rhs.id) {
          return 1;
        }
      }

      if (lhs.attributes === undefined) {
        return -1;
      } else if (rhs.attributes === undefined) {
        return 1;
      }

      const lName = util.renderModName(lhs) ?? "";
      const rName = util.renderModName(rhs) ?? "";
      return lName.localeCompare(rName);
    },
    filter: new DependenciesFilter(
      dependencyState,
      () => {
        const state = api.store.getState();
        return util.getSafe(
          state,
          ["persistent", "mods", selectors.activeGameId(state)],
          {},
        );
      },
      () =>
        util.getSafe(
          api.store.getState(),
          ["session", "dependencies", "conflicts"],
          {},
        ),
    ),
  };

  return res;
}

function nothingNeeds(
  profile: types.IProfile,
  mod: types.IMod,
  among: types.IMod[],
  except: types.IMod,
) {
  const isEnabled = (modId) =>
    util.getSafe(profile, ["modState", modId, "enabled"], false);

  const matchesMod = (rule) =>
    ["requires", "recommends"].includes(rule.type) &&
    util.testModReference(mod, rule.reference);

  return (
    among.find((dependent) => {
      return (
        dependent.id !== except.id &&
        isEnabled(dependent.id) &&
        dependent.rules.find(matchesMod) !== undefined
      );
    }) === undefined
  );
}

function setDependenciesEnabled(
  profile: types.IProfile,
  dependent: types.IMod,
  mods: { [modId: string]: types.IMod },
  recommendations: boolean,
  enabled: boolean,
  allDependents: types.IMod[],
): Redux.Action[] {
  const filter = recommendations ? ["requires", "recommends"] : ["requires"];

  return dependent.rules
    .filter((rule) => filter.includes(rule.type))
    .map((rule) => {
      const mod = util.findModByRef(rule.reference, mods);
      if (
        mod !== undefined &&
        (enabled || nothingNeeds(profile, mod, allDependents, dependent))
      ) {
        return actions.setModEnabled(profile.id, mod.id, enabled);
      } else {
        return undefined;
      }
    })
    .filter((act) => act !== undefined);
}

function queryEnableDependencies(
  api: types.IExtensionApi,
  modIds: string[],
  gameMode: string,
  enabled: boolean,
): Bluebird<void> {
  const t = api.translate;
  const state = api.getState();
  const mods = state.persistent.mods[gameMode];

  const profileId = selectors.lastActiveProfileForGame(state, gameMode);
  const profile = selectors.profileById(state, profileId);
  const dependents = modIds
    .map((id) => {
      const applicableRules = (mods[id]?.rules ?? []).filter((rule) => {
        if (!["requires", "recommends"].includes(rule.type)) {
          return false;
        }

        const refMod = util.findModByRef(rule.reference, mods);
        if (refMod === undefined) {
          return false;
        }

        if (modIds.includes(refMod.id)) {
          return false;
        }

        const isEnabled = profile.modState[refMod.id]?.enabled ?? false;
        if (isEnabled === enabled) {
          return false;
        }

        return true;
      });
      return {
        id,
        rules: applicableRules,
        count: applicableRules.length,
      };
    })
    .filter((ic) => ic.count > 0);

  if (dependents.length > 0) {
    const dialogActions = [
      { label: "Close" },
      { label: enabled ? "Enable" : "Disable" },
    ];
    // review option only available if it's a single mod with dependencies
    if (dependents.length === 1) {
      dialogActions.splice(1, 0, { label: "Review" });
    }

    let md =
      t(
        "The mod you {{enabled}} depends on other mods, do you want to {{enable}} those " +
          "as well?",
        {
          replace: {
            enabled: enabled ? t("enabled") : t("disabled"),
            enable: enabled ? t("enable") : t("disable"),
          },
          count: dependents.length,
        },
      ) + "\n";

    if (!enabled) {
      md +=
        t(
          "This will only disable mods not required by something else but it may disable " +
            "ones you had already enabled manually.",
        ) + "\n";
    }

    md +=
      "\n" +
      dependents
        .map(
          (ic) =>
            `* ${util.renderModName(mods[ic.id])}: ${t("{{count}} dependencies", { count: ic.count })}`,
        )
        .join("\n");

    return api
      .showDialog(
        "question",
        t("Mod has dependencies", { count: dependents.length }),
        {
          md,
          checkboxes: [
            {
              id: "recommendations",
              text: "Apply to Recommended Mods",
              value: false,
            },
          ],
          options: {
            translated: true,
          },
        },
        dialogActions,
      )
      .then((result) => {
        if (result.action === "Review") {
          const batch = [];
          batch.push(
            actions.setAttributeFilter("mods", "dependencies", [
              "depends",
              dependents[0],
              util.renderModName(mods[dependents[0].id]),
            ]),
          );
          batch.push(actions.setAttributeSort("mods", "dependencies", "asc"));
          util.batchDispatch(api.store, batch);
          api.events.emit("show-main-page", "Mods");
        } else if (["Enable", "Disable"].includes(result.action)) {
          const recommendationsToo = result.input["recommendations"];

          // all mods that have any dependencies
          const allDependents = Object.values(mods).filter((mod) =>
            (mod.rules ?? []).find((rule) =>
              ["requires", "recommends"].includes(rule.type),
            ),
          );

          const batch: Redux.Action[] = dependents.reduce((prev, ic) => {
            return [].concat(
              prev,
              ...setDependenciesEnabled(
                profile,
                mods[ic.id],
                mods,
                recommendationsToo,
                enabled,
                allDependents,
              ),
            );
          }, []);
          util.batchDispatch(api.store, batch);
        }
      });
  } else {
    return Bluebird.resolve();
  }
}

// Sometimes I love hoisting..
let updateConflictDebouncer;
function once(api: types.IExtensionApi) {
  const store = api.store;

  const updateRulesDebouncer = new util.Debouncer((gameMode: string) => {
    const state = store.getState();
    gameMode = gameMode || selectors.activeGameId(state);
    return generateLoadOrder(api)
      .then(() =>
        updateMetaRules(api, gameMode, state.persistent.mods[gameMode]),
      )
      .then((rules) => {
        dependencyState.modRules = rules;
        // need to manually update any open conflict dialog - that's not pretty...
        const { conflictDialog } = store.getState().session.dependencies;
        if (!!conflictDialog) {
          store.dispatch(
            setConflictDialog(
              conflictDialog.gameId,
              conflictDialog.modIds,
              rules,
            ),
          );
        }
        dependenciesChanged();
        return null;
      })
      .catch((err) => {
        api.showErrorNotification("Failed to refresh mod rules", err);
      });
  }, 200);

  updateConflictDebouncer = new util.Debouncer(
    async (
      calculateOverrides: boolean,
      batched?: Redux.Action[],
      force?: boolean,
    ) =>
      (!force && shouldSuppressUpdate(api)
        ? Promise.reject(new util.ProcessCanceled("suppressed"))
        : checkConflictsAndRules(api)
      )
        .then(() => {
          const modTypeConflictsEnabled: boolean = util.getSafe(
            api.getState(),
            ["settings", "workarounds", "modTypeConflictsEnabled"],
            true,
          );
          if (!modTypeConflictsEnabled || calculateOverrides === false) {
            return Promise.resolve();
          }

          log("info", "starting overrides update");
          const startTime = new Date().getTime();
          addFileOverrides(api);
          return updateOverrides(api, startTime, batched)
            .then(() => {
              const endTime = new Date().getTime();
              const elapsedTime = (endTime - startTime) / 1000;
              log(
                "info",
                "Updated file overrides in " + elapsedTime + " seconds",
              );
            })
            .catch((err) => {
              // If the user canceled the update (probably during the purge), we don't want to
              //  throw this error as it will be reportable. Reporting this error instead of the
              //  error that led to the user canceling the update obfuscates the actual issue.
              log("warn", "Failed to update file overrides", err);
              return err instanceof util.UserCanceled
                ? Promise.resolve()
                : Promise.reject(err);
            });
        })
        .catch((err) => {
          if (
            err instanceof util.ProcessCanceled &&
            err.message === "suppressed"
          ) {
            return Promise.resolve();
          }
          api.showErrorNotification("Failed to determine mod conflicts", err);
        })
        .finally(() =>
          api.store.dispatch(actions.stopActivity("mods", "conflicts")),
        ),
    2000,
    false,
    true,
  );

  api.setStylesheet(
    "dependency-manager",
    path.join(__dirname, "dependency-manager.scss"),
  );

  api.events.on(
    "will-install-dependencies",
    (
      profileId: string,
      modId: string,
      recommendations: boolean,
      onCancel: () => void,
    ) => {
      api.dismissNotification(UNFULFILLED_NOTIFICATION_ID);
    },
  );

  api.onAsync(
    "did-deploy",
    (profileId: string, deployment: types.IDeploymentManifest) => {
      const hasActiveCollectionSession =
        selectors.getCollectionActiveSession(api.getState()) != null;
      if (!hasActiveCollectionSession) {
        updateConflictDebouncer.schedule(undefined, false, [], true);
      }
      return Promise.resolve();
    },
  );

  api.events.on("profile-did-change", () => {
    const gameMode = selectors.activeGameId(store.getState());
    updateMetaRules(api, gameMode, store.getState().persistent.mods[gameMode])
      .then((rules) => {
        dependencyState.modRules = rules;
        dependenciesChanged();
        updateConflictDebouncer.schedule(undefined, false);
      })
      .catch((err) => {
        api.showErrorNotification("failed to update mod rule cache", err);
      });
  });

  api.events.on("recalculate-modtype-conflicts", (modIds: string[]) => {
    const gameMode = selectors.activeGameId(store.getState());
    updateRulesDebouncer.schedule(() => {
      updateConflictDebouncer.schedule(undefined, true);
    }, gameMode);
  });

  api.events.on(
    "check-file-override-redundancies",
    (gameMode: string, data: { [modId: string]: string[] }) =>
      removeFileOverrideRedundancies(api, gameMode, data),
  );

  api.events.on("gamemode-activated", (gameMode: string) => {
    // We just changed gamemodes - we should clear up any
    //  existing conflict information.
    log("debug", "game mode activated, updating conflict info", { gameMode });
    store.dispatch(setConflictInfo(undefined));
    updateConflictInfo(api, gameMode, {});
    updateRulesDebouncer.schedule(() => {
      updateConflictDebouncer.schedule(undefined, false);
    }, gameMode);
  });

  api.events.on("edit-mod-cycle", (gameId: string, cycle: string[]) => {
    store.dispatch(setEditCycle(gameId, cycle));
  });

  api.onAsync("update-conflicts-and-rules", (calculateOverrides: boolean) => {
    return new Promise<void>((resolve) => {
      const gameMode = selectors.activeGameId(store.getState());
      updateConflictInfo(api, gameMode, {});
      updateRulesDebouncer.schedule(() => {
        updateConflictDebouncer.schedule(() => resolve(), calculateOverrides);
      }, gameMode);
    });
  });

  api.onAsync(
    "did-remove-mod",
    (
      gameMode: string,
      removedId: string,
      modId: string,
      options: { willBeReplaced?: boolean; modData?: types.IMod },
    ) => {
      if (options?.willBeReplaced || options?.modData === undefined) {
        // The mod is being re-installed or replaced by an update;
        //  don't remove any rules.
        return Promise.resolve();
      }
      const state = api.getState();
      const mods: { [modId: string]: types.IMod } =
        state.persistent.mods[gameMode] ?? {};
      const batched = [];
      Object.keys(mods).forEach((id) => {
        // remove all locally defined rules referring to that mod
        const rulesToRemove = (mods[id].rules ?? []).filter(
          (rule: types.IModRule) =>
            ["before", "after"].includes(rule.type) &&
            util.testModReference(options.modData, rule.reference),
        );

        rulesToRemove.forEach((rule) => {
          batched.push(actions.removeModRule(gameMode, id, rule));
        });
      });

      if (batched.length > 0) {
        util.batchDispatch(api.store, batched);
      }
      return Promise.resolve();
    },
  );

  api.onStateChange(["persistent", "mods"], (oldState, newState) => {
    const gameMode = selectors.activeGameId(store.getState());
    if (oldState[gameMode] !== newState[gameMode]) {
      const relevantChange = Object.keys(newState[gameMode]).find(
        (modId) =>
          util.getSafe(oldState, [gameMode, modId], undefined) !==
            newState[gameMode][modId] &&
          changeMayAffectRules(
            util.getSafe(oldState, [gameMode, modId], undefined),
            newState[gameMode][modId],
          ),
      );

      if (relevantChange !== undefined) {
        updateRulesDebouncer.schedule(() => {
          updateConflictDebouncer.schedule(undefined, true);
        }, gameMode);
      }
    }
  });

  api.onAsync(
    "will-enable-mods",
    (profileId: string, modIds: string[], enabled: boolean, options) => {
      // don't query to enable dependencies right after installing the mod
      // (the dependencies will be getting installed/enabled as part of that
      //  installation process automatically)
      // Also don't query if the mod is being reinstalled or upgraded because
      // the assumption is that the replacement will have the same dependencies
      // anyway.
      // This is not a valid assumption but if the dependencies change, we'd
      // only be able to identify the changes after the new version is installed.
      // TODO: currently we're not doing that though
      if (options?.installed || options?.willBeReplaced) {
        return Promise.resolve();
      }
      const profile = selectors.profileById(api.getState(), profileId);
      return queryEnableDependencies(
        api,
        modIds,
        profile.gameId,
        enabled,
      ).catch((err) => {
        api.showErrorNotification("Failed to test for dependencies", err);
      });
    },
  );

  api.events.on(
    "mods-enabled",
    (
      modIds: string[],
      enabled: boolean,
      gameMode: string,
      options?: { silent: boolean; installed: boolean },
    ) => {
      if (gameMode === selectors.activeGameId(store.getState())) {
        updateRulesDebouncer.schedule(() => {
          updateConflictDebouncer.schedule(undefined, true);
        }, gameMode);
      }
    },
  );
}

interface IManageRuleButtonProps {
  notifications: types.INotification[];
  onClick: () => void;
}

class ManageRuleButtonImpl extends PureComponentEx<
  IManageRuleButtonProps & WithT,
  {}
> {
  public render() {
    const { t, onClick, notifications } = this.props;
    const hasConflicts = notifications.find(
      (iter) => iter.id === CONFLICT_NOTIFICATION_ID,
    );
    return (
      <ToolbarIcon
        id="manage-mod-rules-button"
        icon="connection"
        text={t("Manage Rules")}
        className={hasConflicts ? "toolbar-flash-button" : undefined}
        onClick={onClick}
      />
    );
  }
}
function mapStateToProps(state: types.IState) {
  return {
    notifications: state.session.notifications.notifications,
  };
}

const ManageRuleButton = withTranslation(["common"])(
  connect(mapStateToProps)(ManageRuleButtonImpl) as any,
);

const pathTool: IPathTools = {
  isAbsolute: path.isAbsolute,
  relative: path.relative,
  basename: path.basename,
  dirname: path.dirname,
  join: path.join,
  sep: path.sep,
};

function main(context: types.IExtensionContext) {
  context.registerReducer(["settings", "workarounds"], settingsReducer);
  context.registerReducer(["session", "dependencies"], connectionReducer);
  context.registerTableAttribute("mods", makeLoadOrderAttribute(context.api));
  context.registerTableAttribute(
    "mods",
    makeDependenciesAttribute(context.api),
  );
  context.registerAction("mod-icons", 90, ManageRuleButton, {}, () => {
    const state: types.IState = context.api.store.getState();
    return {
      notifications: state.session.notifications.notifications,
      onClick: () =>
        showUnsolvedConflictsDialog(
          context.api,
          dependencyState.modRules,
          true,
        ),
    };
  });
  context.registerDialog("mod-dependencies-connector", Connector);
  context.registerDialog("mod-dependencies-editor", Editor);
  context.registerDialog("mod-conflict-editor", ConflictEditor, () => ({
    pathTool,
  }));
  context.registerDialog("mod-cycle-graph", () => (
    <ConflictGraph
      width={500}
      height={500}
      nodeDistance={80}
      nodeRadius={10}
      localState={dependencyState}
    />
  ));

  context.registerDialog("mod-fileoverride-editor", OverrideEditor, () => ({
    localState: dependencyState,
    pathTool,
    onSetFileOverrides: async (batchedActions) => {
      const state = context.api.getState();
      const modTypeConflictsEnabled: boolean = util.getSafe(
        state,
        ["settings", "workarounds", "modTypeConflictsEnabled"],
        true,
      );
      if (!modTypeConflictsEnabled) {
        util.batchDispatch(context.api.store.dispatch, batchedActions);
      } else {
        updateConflictDebouncer.schedule(undefined, true, batchedActions);
      }
    },
    toRelPath: (mod: types.IMod, filePath: string) => {
      const state = context.api.getState();
      const gameId = selectors.activeGameId(state);
      const discovery = selectors.discoveryByGame(state, gameId);
      if (discovery?.path === undefined) {
        return null;
      }
      const game: types.IGame = util.getGame(gameId);
      const modPaths = game.getModPaths(discovery.path);
      const modPath = modPaths[mod.type];
      if (modPath === undefined) {
        return null;
      }
      return pathTool.relative(modPath, filePath);
    },
  }));
  context.registerAction(
    "mods-action-icons",
    100,
    "groups",
    {},
    "Manage File Conflicts",
    (instanceIds) => {
      const { store } = context.api;
      const gameMode = selectors.activeGameId(store.getState());
      store.dispatch(setFileOverrideDialog(gameMode, instanceIds[0]));
    },
    (instanceIds) => {
      const { store, translate } = context.api;
      return util.getSafe(
        store.getState(),
        ["session", "dependencies", "conflicts", instanceIds[0]],
        [],
      ).length > 0
        ? true
        : "No file conflicts";
    },
  );

  context.registerControlWrapper("mods-name", 100, ModNameWrapper);
  context.registerTest(
    "redundant-file-overrides",
    "gamemode-activated",
    checkRedundantFileOverrides(context.api),
  );

  context.registerSettings("Workarounds", Settings, () => ({
    onSetModTypeConflicts: async (enable: boolean) => {
      await util.toPromise((cb) =>
        context.api.events.emit("purge-mods", true, cb),
      );
      if (enable) {
        context.api.store.dispatch(setModTypeConflictsSetting(enable));
      } else {
        try {
          await disableModTypeConflictsDialog(context.api);
        } catch (err) {
          if (!(err instanceof util.UserCanceled)) {
            context.api.showErrorNotification(
              "Failed to disable mod type conflicts",
              err,
            );
          }
          return;
        }
      }

      updateConflictDebouncer.schedule(undefined, true);
    },
  }));
  context.registerStartHook(
    50,
    "check-unsolved-conflicts",
    (input: types.IRunParameters) =>
      input.options.suggestDeploy !== false
        ? unsolvedConflictsCheck(context.api, dependencyState.modRules, input)
        : Bluebird.resolve(input),
  );

  context.once(() => once(context.api));

  return true;
}

export default main;
