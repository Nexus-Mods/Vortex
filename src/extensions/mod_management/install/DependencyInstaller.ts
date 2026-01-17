/**
 * DependencyInstaller - Handles dependency installation dialogs and utilities.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module provides:
 * - Dependency confirmation dialogs (memo dialogs, recommendation queries)
 * - Mod rule updates after dependency installation
 * - Helper utilities for dependency installation
 *
 * Note: The core orchestration logic (doInstallDependencies, doInstallDependenciesPhase)
 * remains in InstallManager due to tight coupling with InstallManager's internal state
 * (concurrency limiters, phase management, download/install tracking, etc.).
 */

import Bluebird from "bluebird";

import { showDialog } from "../../../actions/notifications";
import type { ICheckbox, IDialogResult } from "../../../types/IDialog";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IBatchContext } from "../../../util/BatchContext";
import { getSafe } from "../../../util/storeHelper";
import { truthy } from "../../../util/util";

import type { IDependency, IDependencyError } from "../types/IDependency";
import type { IMod, IModReference, IModRule } from "../types/IMod";
import { addModRule, removeModRule } from "../actions/mods";
import modName, { renderModReference } from "../util/modName";
import { referenceEqual } from "../util/testModReference";
import type { IRule } from "modmeta-db";
import { hasFuzzyReference } from "./ModLookupService";
import type { IState } from "../../../types/IState";

/**
 * Show the dependency memo dialog to confirm installation.
 *
 * This dialog lists dependencies that need to be downloaded/installed,
 * those that need to be enabled, and any errors.
 *
 * @param api - Extension API
 * @param context - Batch context for tracking "remember" preference
 * @param name - Name of the mod with dependencies
 * @param success - Dependencies that can be installed
 * @param error - Dependencies that could not be resolved
 * @returns Dialog result with user's choice
 */
export function showMemoDialog(
  api: IExtensionApi,
  context: IBatchContext,
  name: string,
  success: IDependency[],
  error: IDependencyError[],
): Bluebird<IDialogResult> {
  const remember = context.get<boolean>("remember", null);

  if (truthy(remember)) {
    return Bluebird.resolve<IDialogResult>({
      action: remember ? "Install" : "Don't Install",
      input: {},
    });
  } else {
    const downloads = api.getState().persistent.downloads.files;

    const t = api.translate;

    const requiredInstalls = success.filter((dep) => dep.mod === undefined);
    const requiredDownloads = requiredInstalls.filter(
      (dep) =>
        dep.download === undefined ||
        [undefined, "paused"].includes(downloads[dep.download]?.state),
    );
    const requireEnableOnly = success.filter((dep) => dep.mod !== undefined);

    let bbcode = "";

    let list: string = "";
    if (requiredDownloads.length > 0) {
      list +=
        `[h4]${t("Require Download & Install")}[/h4]<br/>[list]` +
        requiredDownloads
          .map((mod) => "[*]" + renderModReference(mod.reference))
          .join("\n") +
        "[/list]<br/>";
    }
    const requireInstallOnly = requiredInstalls.filter(
      (mod) => !requiredDownloads.includes(mod),
    );
    if (requireInstallOnly.length > 0) {
      list +=
        `[h4]${t("Require Install")}[/h4]<br/>[list]` +
        requireInstallOnly
          .map((mod) => "[*]" + renderModReference(mod.reference))
          .join("\n") +
        "[/list]<br/>";
    }
    if (requireEnableOnly.length > 0) {
      list +=
        `[h4]${t("Will be enabled")}[/h4]<br/>[list]` +
        requireEnableOnly.map((mod) => "[*]" + modName(mod.mod)).join("\n") +
        "[/list]";
    }

    if (success.length > 0) {
      bbcode += t("{{modName}} requires the following dependencies:", {
        replace: { modName: name },
      });
    }

    if (error.length > 0) {
      bbcode +=
        "[color=red]" +
        t(
          "{{modName}} has unsolved dependencies that could not be found automatically. ",
          { replace: { modName: name } },
        ) +
        t("Please install them manually") +
        ":<br/>" +
        "{{errors}}" +
        "[/color]";
    }

    if (list.length > 0) {
      bbcode += "<br/>" + list;
    }

    const actions =
      success.length > 0
        ? [{ label: "Don't install" }, { label: "Install" }]
        : [{ label: "Close" }];

    return api.store
      .dispatch(
        showDialog(
          "question",
          t("Install Dependencies"),
          {
            bbcode,
            parameters: {
              modName: name,
              count: success.length,
              instCount: requiredInstalls.length,
              dlCount: requiredDownloads.length,
              errors: error.map((err) => err.error).join("<br/>"),
            },
            checkboxes: [
              {
                id: "remember",
                text: "Do this for all dependencies",
                value: false,
              },
            ],
            options: {
              translated: true,
            },
          },
          actions,
        ),
      )
      .then((result) => {
        if (result.input["remember"]) {
          context.set("remember", result.action === "Install");
        }
        return result;
      });
  }
}

/**
 * Show the main recommendations query dialog.
 *
 * This is the first dialog shown when installing recommendations,
 * allowing the user to skip, manually select, or install all.
 *
 * @param api - Extension API
 * @param modName - Name of the mod with recommendations
 * @param success - Recommendations that can be installed
 * @param error - Recommendations that could not be resolved
 * @param remember - Cached user preference (true=install all, false=skip)
 * @returns Dialog result
 */
export function installRecommendationsQueryMain(
  api: IExtensionApi,
  modNameStr: string,
  success: IDependency[],
  error: IDependencyError[],
  remember: boolean | null,
): Bluebird<IDialogResult> {
  if (remember === true) {
    return Bluebird.resolve({ action: "Install All", input: {} });
  } else if (remember === false) {
    return Bluebird.resolve({ action: "Skip", input: {} });
  }
  let bbcode: string = "";
  if (success.length > 0) {
    bbcode +=
      "{{modName}} recommends the installation of additional mods. " +
      "Please use the checkboxes below to select which to install.<br/><br/>[list]";
    for (const item of success) {
      bbcode += `[*] ${renderModReference(item.reference, undefined)}`;
    }

    bbcode += "[/list]";
  }

  if (error.length > 0) {
    bbcode +=
      "[color=red]" +
      "{{modName}} has unsolved dependencies that could not be found automatically. " +
      "Please install them manually." +
      "[/color][list]";
    for (const item of error) {
      bbcode += `[*] ${item.error}`;
    }
    bbcode += "[/list]";
  }

  return api.store.dispatch(
    showDialog(
      "question",
      "Install Recommendations",
      {
        bbcode,
        checkboxes: [
          {
            id: "remember",
            text: "Do this for all recommendations",
            value: false,
          },
        ],
        parameters: {
          modName: modNameStr,
        },
      },
      [
        { label: "Skip" },
        { label: "Manually Select" },
        { label: "Install All" },
      ],
    ),
  );
}

/**
 * Show the recommendations selection dialog.
 *
 * This dialog allows users to select specific recommendations to install.
 *
 * @param api - Extension API
 * @param modNameStr - Name of the mod with recommendations
 * @param success - Recommendations available to install
 * @returns Dialog result with selected checkboxes
 */
export function installRecommendationsQuerySelect(
  api: IExtensionApi,
  modNameStr: string,
  success: IDependency[],
): Bluebird<IDialogResult> {
  let bbcode: string = "";
  if (success.length > 0) {
    bbcode +=
      "{{modName}} recommends the installation of additional mods. " +
      "Please use the checkboxes below to select which to install.<br/><br/>";
  }

  const checkboxes: ICheckbox[] = success.map((dep, idx) => {
    let depName: string;
    if (dep.lookupResults.length > 0) {
      depName = dep.lookupResults[0].value.fileName;
    }
    if (depName === undefined) {
      depName = renderModReference(dep.reference, undefined);
    }

    let desc = depName;
    if (dep.download === undefined) {
      desc += " (" + api.translate("Not downloaded yet") + ")";
    }
    return {
      id: idx.toString(),
      text: desc,
      value: true,
    };
  });

  return api.store.dispatch(
    showDialog(
      "question",
      "Install Recommendations",
      {
        bbcode,
        checkboxes,
        parameters: {
          modName: modNameStr,
        },
      },
      [{ label: "Don't install" }, { label: "Continue" }],
    ),
  );
}

/**
 * Update a mod rule after dependency installation.
 *
 * This updates the rule reference with hints about the installed mod.
 *
 * @param api - Extension API
 * @param gameId - Game ID
 * @param sourceModId - ID of the mod that has the rule
 * @param dep - The dependency that was installed
 * @param reference - Updated reference to use
 * @param recommended - Whether this is a recommendation (vs required)
 * @returns The updated rule, or undefined if no matching rule found
 */
export function updateModRule(
  api: IExtensionApi,
  gameId: string,
  sourceModId: string,
  dep: IDependency,
  reference: IModReference,
  recommended: boolean,
): IRule | undefined {
  const state: IState = api.store.getState();
  const rules: IModRule[] = getSafe(
    state.persistent.mods,
    [gameId, sourceModId, "rules"],
    [],
  );
  const oldRule = rules.find((iter) =>
    referenceEqual(iter.reference, dep.reference),
  );

  if (oldRule === undefined) {
    return undefined;
  }

  const updatedRule: IRule = {
    ...(oldRule || {}),
    type: recommended ? "recommends" : "requires",
    reference,
  };

  api.store.dispatch(removeModRule(gameId, sourceModId, oldRule));
  api.store.dispatch(addModRule(gameId, sourceModId, updatedRule));
  return updatedRule;
}

/**
 * Update multiple mod rules after dependency installation.
 *
 * @param api - Extension API
 * @param gameId - Game ID
 * @param sourceModId - ID of the mod that has the rules
 * @param dependencies - Dependencies that were installed
 * @param recommended - Whether these are recommendations (vs required)
 */
export function updateRules(
  api: IExtensionApi,
  gameId: string,
  sourceModId: string,
  dependencies: IDependency[],
  recommended: boolean,
): Bluebird<void> {
  dependencies.forEach((dep) => {
    const updatedRef: IModReference = { ...dep.reference };
    updatedRef.idHint = dep.mod?.id;
    updatedRef.installerChoices = dep.installerChoices;
    updatedRef.patches = dep.patches;
    updatedRef.fileList = dep.fileList;
    updateModRule(api, gameId, sourceModId, dep, updatedRef, recommended);
  });
  return Bluebird.resolve();
}

/**
 * Repair mod rules that have stale reference IDs.
 *
 * When dependencies get uninstalled and reinstalled, the mod IDs change.
 * If the old rule still references the old mod ID, installing dependencies
 * would fail. This function clears stale IDs from rules that have fuzzy
 * references, allowing them to be resolved again.
 *
 * @param api - Extension API
 * @param mod - The mod whose rules need repair
 * @param gameId - Game ID
 */
export function repairRules(
  api: IExtensionApi,
  mod: IMod,
  gameId: string,
): void {
  const state: IState = api.store.getState();
  const mods = state.persistent.mods[gameId];

  (mod.rules || []).forEach((rule) => {
    if (
      rule.reference.id !== undefined &&
      mods[rule.reference.id] === undefined &&
      hasFuzzyReference(rule.reference)
    ) {
      const newRule: IModRule = JSON.parse(JSON.stringify(rule));
      api.store.dispatch(removeModRule(gameId, mod.id, rule));
      delete newRule.reference.id;
      api.store.dispatch(addModRule(gameId, mod.id, newRule));
    }
  });
}

/**
 * DependencyInstaller class - provides dependency installation utilities.
 *
 * This class wraps the standalone functions for cases where a class-based
 * interface is preferred. The core orchestration logic remains in
 * InstallManager due to tight coupling with internal state.
 */
export class DependencyInstaller {
  private mApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  /**
   * Show the dependency memo dialog.
   */
  public showMemoDialog(
    context: IBatchContext,
    name: string,
    success: IDependency[],
    error: IDependencyError[],
  ): Bluebird<IDialogResult> {
    return showMemoDialog(this.mApi, context, name, success, error);
  }

  /**
   * Show the main recommendations query dialog.
   */
  public installRecommendationsQueryMain(
    modNameStr: string,
    success: IDependency[],
    error: IDependencyError[],
    remember: boolean | null,
  ): Bluebird<IDialogResult> {
    return installRecommendationsQueryMain(
      this.mApi,
      modNameStr,
      success,
      error,
      remember,
    );
  }

  /**
   * Show the recommendations selection dialog.
   */
  public installRecommendationsQuerySelect(
    modNameStr: string,
    success: IDependency[],
  ): Bluebird<IDialogResult> {
    return installRecommendationsQuerySelect(this.mApi, modNameStr, success);
  }

  /**
   * Update a mod rule after dependency installation.
   */
  public updateModRule(
    gameId: string,
    sourceModId: string,
    dep: IDependency,
    reference: IModReference,
    recommended: boolean,
  ): IRule | undefined {
    return updateModRule(
      this.mApi,
      gameId,
      sourceModId,
      dep,
      reference,
      recommended,
    );
  }

  /**
   * Update multiple mod rules after dependency installation.
   */
  public updateRules(
    gameId: string,
    sourceModId: string,
    dependencies: IDependency[],
    recommended: boolean,
  ): Bluebird<void> {
    return updateRules(
      this.mApi,
      gameId,
      sourceModId,
      dependencies,
      recommended,
    );
  }
}
