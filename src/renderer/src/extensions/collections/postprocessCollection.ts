import * as _ from "lodash";

import * as actions from "../../actions";
import { log } from "../../logging";
import type { IExtensionApi } from "../../types/IExtensionContext";
import { batchDispatch, toPromise } from "../../util/util";
import type { IMod, IModRule } from "../mod_management/types/IMod";
import { findModByRef } from "../mod_management/util/findModByRef";
import testModReference from "../mod_management/util/testModReference";
import { activeProfileId } from "../profile_management/selectors";
import type { ICollection } from "./types/ICollection";
import { applyCollectionPluginOrder } from "./util/bethesdaLoadOrder";
import type { IExtensionFeature } from "./util/extension";
import { findExtensions } from "./util/extension";
import { parseGameSpecifics } from "./util/gameSupport";

function applyCollectionRules(
  api: IExtensionApi,
  gameId: string,
  collection: ICollection,
  mods: { [modId: string]: IMod },
) {
  const batch = (collection.modRules ?? []).reduce((prev, rule) => {
    const sourceMod = findModByRef(rule.source, mods);
    if (sourceMod !== undefined) {
      const destMod = findModByRef(rule.reference, mods);

      let exists: boolean = false;
      if (destMod !== undefined) {
        // replace existing rules between these two mods
        const exSourceRules = (sourceMod.rules ?? []).filter(
          (iter: IModRule) =>
            ["before", "after"].includes(iter.type) && testModReference(destMod, iter.reference),
        );
        exSourceRules.forEach((exSourceRule: IModRule) => {
          const copy = JSON.parse(JSON.stringify(exSourceRule));
          delete copy.reference.idHint;
          if (!exists && _.isEqual(copy, rule)) {
            exists = true;
          } else {
            prev.push(actions.removeModRule(gameId, sourceMod.id, exSourceRule));
          }
        });
        const exDestRules = (destMod.rules ?? []).filter(
          (iter: IModRule) =>
            ["before", "after"].includes(iter.type) && testModReference(sourceMod, iter.reference),
        );
        exDestRules.forEach((exDestRule: IModRule) => {
          prev.push(actions.removeModRule(gameId, destMod.id, exDestRule));
        });
        rule.reference = {
          id: destMod.id,
          idHint: destMod.id,
          archiveId: destMod.archiveId,
        };
      }

      if (!exists) {
        log("info", "add collection rule", {
          gameId,
          sourceMod: sourceMod.id,
          rule: JSON.stringify(rule),
        });
        prev.push(actions.addModRule(gameId, sourceMod.id, rule));
      }
    }
    return prev;
  }, []);

  batchDispatch(api.store, batch);
}

/**
 * postprocess a collection. This is called after dependencies for the pack have been installed.
 * It may get called multiple times so it has to take care to not break if any data already
 * exists
 */
export async function postprocessCollection(
  api: IExtensionApi,
  gameId: string,
  collectionMod: IMod,
  collection: ICollection,
  mods: { [modId: string]: IMod },
  manualOrderProfileId?: string,
) {
  const isTargetActive = () =>
    manualOrderProfileId === undefined || activeProfileId(api.getState()) === manualOrderProfileId;
  if (!isTargetActive()) return;
  log("info", "postprocess collection");
  applyCollectionRules(api, gameId, collection, mods);
  try {
    // TODO: replace this with a call to the awaitModsDeployment API extension method
    await toPromise((cb) =>
      api.events.emit("deploy-mods", cb, undefined, undefined, {
        isCollectionPostprocessCall: true,
      }),
    );
  } catch (err) {
    log("warn", "Failed to deploy during collection post processing");
  }
  if (!isTargetActive()) return;

  const exts: IExtensionFeature[] = findExtensions(api.getState(), gameId);

  for (const ext of exts) {
    await ext.parse(gameId, collection, collectionMod);
    if (!isTargetActive()) return;
  }

  await parseGameSpecifics(api, gameId, collection, collectionMod, manualOrderProfileId);
  if (!isTargetActive()) return;
  if (manualOrderProfileId !== undefined) {
    await api.emitAndAwait("refresh-collection-plugins", manualOrderProfileId, gameId);
    await applyCollectionPluginOrder(api, manualOrderProfileId, gameId, collection, collectionMod);
  }
  if (!isTargetActive()) return;
  api.events.emit("collection-postprocess-complete", gameId, collectionMod.id);
}
