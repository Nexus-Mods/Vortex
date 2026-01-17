/**
 * DependencyPhaseHelpers - Helper functions for dependency phase installation.
 * Extracted from InstallManager.ts for better modularity and testability.
 *
 * This module provides:
 * - Extra rule application to mods
 * - Unfulfillable dependency handling
 */

import _ from "lodash";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { log } from "../../../util/log";

import { resolveCategoryId } from "../../category_management/util/retrieveCategoryPath";

import { addModRule, setModAttributes, setModType } from "../actions/mods";
import type { IDependency } from "../types/IDependency";
import modName, { renderModReference } from "../util/modName";

/**
 * Apply extra data from a dependency rule to a mod.
 *
 * This sets various mod attributes based on the extra data specified
 * in the dependency rule, such as type, name, URL, category, author, version,
 * patches, file list, and installer choices.
 *
 * @param api - Extension API
 * @param gameId - Game ID
 * @param modId - Mod ID to apply attributes to
 * @param extra - Extra data from the dependency rule
 */
export function applyExtraFromRule(
  api: IExtensionApi,
  gameId: string,
  modId: string,
  extra?: { [key: string]: any },
): void {
  if (extra === undefined) {
    return;
  }

  if (extra.type !== undefined) {
    api.store.dispatch(setModType(gameId, modId, extra.type));
  }

  const attributes: { [key: string]: any } = {};

  if (extra.name !== undefined) {
    attributes["customFileName"] = extra.name;
  }

  if (extra.url !== undefined) {
    attributes["source"] = "website";
    attributes["url"] = extra.url;
  }

  if (extra.category !== undefined) {
    const categoryId = resolveCategoryId(extra.category, api.getState());
    if (categoryId !== undefined) {
      attributes["category"] = categoryId;
    }
  }

  if (extra.author !== undefined) {
    attributes["author"] = extra.author;
  }

  if (extra.version !== undefined) {
    attributes["version"] = extra.version;
  }

  if (extra.patches !== undefined) {
    attributes["patches"] = extra.patches;
  }

  if (extra.fileList !== undefined) {
    attributes["fileList"] = extra.fileList;
  }

  if (extra.installerChoices !== undefined) {
    attributes["installerChoices"] = extra.installerChoices;
  }

  api.store.dispatch(setModAttributes(gameId, modId, attributes));
}

/**
 * Handle an unfulfillable dependency by marking the rule as ignored.
 *
 * This is called when a dependency cannot be automatically fulfilled
 * (e.g., the file is not available, the mod has been removed, etc.).
 * It adds the rule with an "ignored" flag and shows a warning notification
 * to the user.
 *
 * @param api - Extension API
 * @param dep - The dependency that couldn't be fulfilled
 * @param gameId - Game ID
 * @param sourceModId - ID of the mod that has the dependency
 * @param recommended - Whether this is a recommendation (true) or requirement (false)
 */
export function dropUnfulfilled(
  api: IExtensionApi,
  dep: IDependency,
  gameId: string,
  sourceModId: string,
  recommended: boolean,
): void {
  log("info", "ignoring unfulfillable rule", { gameId, sourceModId, dep });

  if (recommended) {
    // not ignoring recommended dependencies because what would be the point?
    return;
  }

  const refName = renderModReference(dep.reference, undefined);
  api.store.dispatch(
    addModRule(gameId, sourceModId, {
      type: recommended ? "recommends" : "requires",
      ..._.pick(dep, ["reference", "extra", "fileList", "installerChoices"]),
      ignored: true,
    }),
  );

  api.sendNotification({
    type: "warning",
    title: "Unfulfillable rule dropped",
    group: "unfulfillable-rule-dropped",
    message: refName,
    actions: [
      {
        title: "More",
        action: () => {
          const sourceMod =
            api.getState().persistent.mods[gameId]?.[sourceModId];
          api.showDialog(
            "info",
            "Unfulfillable rule disabled",
            {
              text:
                'The mod "{{modName}}" has a dependency on "{{refName}}" which ' +
                "Vortex is not able to fulfill automatically.\n\n" +
                "Very likely Vortex would also not recognize the rule as " +
                "fulfilled even if you did install it manually. Therefore the rule " +
                "has been disabled.\n\n" +
                "Please consult the mod instructions on if and how to solve this dependency.",
              parameters: {
                modName: modName(sourceMod),
                refName,
              },
            },
            [{ label: "Close" }],
          );
        },
      },
    ],
  });
}
