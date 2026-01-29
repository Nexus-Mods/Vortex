/* eslint-disable */
import { ICollection, ICollectionTool } from "./types/ICollection";

import { findExtensions, IExtensionFeature } from "./util/extension";
import { parseGameSpecifics } from "./util/gameSupport";
import { collectionModToRule } from "./util/transformCollection";

import { BUNDLED_PATH, MOD_TYPE } from "./constants";

import * as _ from "lodash";
import * as path from "path";
import { actions, fs, log, selectors, types, util } from "vortex-api";
import { readCollection } from "./util/importCollection";
import { ICollectionConfig } from "./types/ICollectionConfig";
import { parseConfig } from "./util/collectionConfig";

/**
 * supported test for use in registerInstaller
 */
export async function testSupported(
  files: string[],
  gameId: string,
): Promise<types.ISupportedResult> {
  return {
    supported: files.indexOf("collection.json") !== -1,
    requiredFiles: ["collection.json"],
  };
}

/**
 * installer function to be used with registerInstaller
 */
export function makeInstall(api: types.IExtensionApi) {
  return async (
    files: string[],
    destinationPath: string,
    gameId: string,
    progressDelegate: types.ProgressDelegate,
  ): Promise<types.IInstallResult> => {
    const collection: ICollection = await readCollection(
      api,
      path.join(destinationPath, "collection.json"),
    );

    const config: ICollectionConfig = await parseConfig({ collection, gameId });
    const configInstructions: types.IInstruction[] = Object.entries(
      config,
    ).reduce((accum, [key, value]) => {
      const instr: types.IInstruction = { type: "attribute", key, value };
      accum.push(instr);
      return accum;
    }, []);
    const filesToCopy = files.filter(
      (filePath) =>
        !filePath.endsWith(path.sep) &&
        filePath.split(path.sep)[0] !== BUNDLED_PATH,
    );

    const bundled = files.filter(
      (filePath) =>
        !filePath.endsWith(path.sep) &&
        filePath.split(path.sep)[0] === BUNDLED_PATH,
    );

    const knownGames = selectors.knownGames(api.getState());

    // Attempt to get the download for this collection to resolve the collection's name
    //  which may have been modified on the website and is therefore different than the value
    //  in the json file.
    // We reverse the downloads array as it's likely that the user just downloaded this
    //  from the website and therefore the download entry is somewhere at the bottom.
    // (pointless optimisation ?)
    const state = api.getState();
    const downloads = Object.values(state.persistent.downloads.files).reverse();
    const collectionDownload = downloads.find(
      (down) =>
        down.localPath !== undefined &&
        path.basename(destinationPath, ".installing") ===
          path.basename(down.localPath, path.extname(down.localPath)),
    );

    return Promise.resolve({
      instructions: [
        {
          type: "attribute" as any,
          key: "customFileName",
          value:
            collectionDownload?.modInfo?.name !== undefined
              ? collectionDownload.modInfo.name
              : collection.info.name,
        },
        {
          type: "attribute",
          key: "installInstructions",
          value: collection.info.installInstructions,
        },
        ...configInstructions,
        {
          type: "setmodtype" as any,
          value: MOD_TYPE,
        },
        ...filesToCopy.map((filePath) => ({
          type: "copy" as any,
          source: filePath,
          destination: filePath,
        })),
        ...bundled.map((filePath) => ({
          type: "copy" as any,
          source: filePath,
          destination: filePath,
        })),
        ...collection.mods.map((mod) => ({
          type: "rule" as any,
          rule: collectionModToRule(knownGames, mod),
        })),
      ],
    });
  };
}

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
