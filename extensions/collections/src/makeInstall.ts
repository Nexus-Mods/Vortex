/* eslint-disable */
import { ICollection } from "./types/ICollection";
import { collectionModToRule } from "./util/transformCollection";

import { BUNDLED_PATH, MOD_TYPE } from "./constants";

import * as path from "path";
import { selectors, types } from "vortex-api";
import { readCollection } from "./util/readCollection";
import { ICollectionConfig } from "./types/ICollectionConfig";
import { parseConfig } from "./util/collectionConfig";

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
