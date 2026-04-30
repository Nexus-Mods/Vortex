import { ICollection } from "./types/ICollection";

import { findExtensions, IExtensionFeature } from "./util/extension";
import { parseGameSpecifics } from "./util/gameSupport";

import * as _ from "lodash";
import { actions, log, types, util } from "vortex-api";

function applyCollectionRules(
  api: types.IExtensionApi,
  gameId: string,
  collection: ICollection,
  mods: { [modId: string]: types.IMod },
) {
  const batch = (collection.modRules ?? []).reduce((prev, rule) => {
    const sourceMod = util.findModByRef(rule.source, mods);
    if (sourceMod !== undefined) {
      const destMod = util.findModByRef(rule.reference, mods);

      let exists: boolean = false;
      if (destMod !== undefined) {
        // replace existing rules between these two mods
        const exSourceRules = (sourceMod.rules ?? []).filter(
          (iter) =>
            ["before", "after"].includes(iter.type) &&
            util.testModReference(destMod, iter.reference),
        );
        exSourceRules.forEach((exSourceRule) => {
          const copy = JSON.parse(JSON.stringify(exSourceRule));
          delete copy.reference.idHint;
          if (!exists && _.isEqual(copy, rule)) {
            exists = true;
          } else {
            prev.push(
              actions.removeModRule(gameId, sourceMod.id, exSourceRule),
            );
          }
        });
        const exDestRules = (destMod.rules ?? []).filter(
          (iter) =>
            ["before", "after"].includes(iter.type) &&
            util.testModReference(sourceMod, iter.reference),
        );
        exDestRules.forEach((exDestRule) => {
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

  util.batchDispatch(api.store, batch);
}

/**
 * postprocess a collection. This is called after dependencies for the pack have been installed.
 * It may get called multiple times so it has to take care to not break if any data already
 * exists
 */
export async function postprocessCollection(
  api: types.IExtensionApi,
  gameId: string,
  collectionMod: types.IMod,
  collection: ICollection,
  mods: { [modId: string]: types.IMod },
) {
  log("info", "postprocess collection");
  applyCollectionRules(api, gameId, collection, mods);
  try {
    // TODO: replace this with a call to the awaitModsDeployment API extension method
    await util.toPromise((cb) =>
      api.events.emit("deploy-mods", cb, undefined, undefined, {
        isCollectionPostprocessCall: true,
      }),
    );
  } catch (err) {
    log("warn", "Failed to deploy during collection post processing");
  }

  const exts: IExtensionFeature[] = findExtensions(api.getState(), gameId);

  for (const ext of exts) {
    await ext.parse(gameId, collection, collectionMod);
  }

  await parseGameSpecifics(api, gameId, collection, collectionMod);
  api.events.emit("collection-postprocess-complete", gameId, collectionMod.id);
}
