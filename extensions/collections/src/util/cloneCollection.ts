import { MOD_TYPE } from "../constants";
import { ICollection, ICollectionAttributes } from "../types/ICollection";
import { findExtensions, IExtensionFeature } from "./extension";
import { hasEditPermissions } from "./util";

import * as path from "path";
import { fs, selectors, types, util } from "vortex-api";

function deduceCollectionAttributes(
  collectionMod: types.IMod,
  collection: ICollection,
  mods: { [modId: string]: types.IMod },
): ICollectionAttributes {
  const existingInstallMode: { [modId: string]: string } =
    collectionMod.attributes?.collection?.installMode ?? {};

  const res: ICollectionAttributes = {
    collectionConfig: collection["collectionConfig"],
    installInstructions: collection.info?.installInstructions,
    installMode: {},
    instructions: {},
    source: {},
    saveEdits: {},
  };

  (collectionMod.rules ?? []).forEach((rule) => {
    const mod = util.findModByRef(rule.reference, mods);
    if (mod === undefined) {
      // allowing mods to be missing, prior to r32 this would throw an exception
      return;
    }

    res.installMode[mod.id] =
      rule.installerChoices !== undefined
        ? "choices"
        : rule.fileList !== undefined
          ? "clone"
          : (existingInstallMode[mod.id] ?? "fresh");

    res.instructions[mod.id] = rule.extra?.instructions;
    res.source[mod.id] = {
      type:
        rule.downloadHint?.mode ??
        (rule.reference.repo?.repository === "nexus" ? "nexus" : "bundle"),
      url: rule.downloadHint?.url,
      instructions: rule.downloadHint?.instructions,
    };
    res.saveEdits[mod.id] = rule.extra?.patches !== undefined;
  });

  return res;
}

/**
 * clone an existing collection
 * @returns on success, returns the new collection id. On failure, returns undefined,
 *          in that case an error notification has already been reported
 */
export async function cloneCollection(
  api: types.IExtensionApi,
  gameId: string,
  id: string,
  sourceId: string,
): Promise<string> {
  const state = api.getState();
  const t = api.translate;

  const { userInfo } = state.persistent["nexus"] ?? {};
  const mods = state.persistent.mods[gameId] ?? {};
  const existingCollection: types.IMod = mods[sourceId];

  const stagingPath = selectors.installPathForGame(state, gameId);

  let collection: ICollection;

  try {
    const collectionData = await fs.readFileAsync(
      path.join(
        stagingPath,
        existingCollection.installationPath,
        "collection.json",
      ),
      { encoding: "utf-8" },
    );
    collection = JSON.parse(collectionData);
  } catch (err) {
    api.showErrorNotification("Failed to clone collection", err);
    return undefined;
  }

  const ruleFilter = (rule: types.IModRule) => {
    if (rule.ignored) {
      return false;
    }

    if (util.findModByRef(rule.reference, mods) === undefined) {
      return false;
    }

    return true;
  };

  const ruleSimplify = (rule: types.IModRule): types.IModRule => {
    const referencedMod = util.findModByRef(rule.reference, mods);
    return {
      ...rule,
      reference: {
        archiveId: referencedMod.archiveId,
        id: referencedMod.id,
        idHint: referencedMod.id,
        versionMatch: rule.reference.versionMatch,
      },
    };
  };

  let isContributing: boolean = false;
  let isCloning: boolean = false;
  let editPermissions: boolean = hasEditPermissions(
    existingCollection.attributes?.permissions || [],
  );
  let ownCollection: boolean =
    userInfo?.userId != null &&
    existingCollection.attributes?.uploaderId === userInfo.userId;
  if (editPermissions && !ownCollection) {
    const result: types.IDialogResult = await api.showDialog(
      "question",
      "Clone Collection",
      {
        bbcode:
          'You have edit permissions for the collection "{{name}}", but you are not the owner.[br][/br]' +
          "Would you like to clone it as your own collection, or contribute to the existing one?[br][/br][br][/br]",
        parameters: {
          name: util.renderModName(existingCollection),
        },
      },
      [{ label: "Contribute" }, { label: "Clone", default: true }],
    );
    if (result.action === "Clone") {
      ownCollection = true;
      isCloning = true;
    } else {
      ownCollection = false;
      isContributing = true;
    }
  }

  const shouldCopyAttributes = () =>
    !isCloning && (ownCollection || isContributing);
  const cloneFileName = t("Copy of {{name}}", {
    replace: { name: existingCollection.attributes?.customFileName },
  });
  const existingFileName = existingCollection.attributes?.customFileName;
  const customFileName = shouldCopyAttributes()
    ? existingFileName
    : cloneFileName;

  const ownCollectionAttributes = shouldCopyAttributes()
    ? {
        pictureUrl: existingCollection.attributes.pictureUrl,
        uploader:
          existingCollection.attributes.uploader ??
          userInfo?.name ??
          "Anonymous",
        uploaderAvatar: existingCollection.attributes.uploaderAvatar,
        author:
          existingCollection.attributes?.author ??
          userInfo?.name ??
          "Anonymous",
        uploaderId:
          existingCollection.attributes?.uploaderId ?? userInfo?.userId,
        permissions: existingCollection.attributes?.permissions,
      }
    : {};

  const mod: types.IMod = {
    id,
    type: MOD_TYPE,
    state: "installed",
    attributes: {
      customFileName,
      version: shouldCopyAttributes()
        ? existingCollection.attributes?.version
        : "0",
      installTime: new Date().toString(),
      author: userInfo?.name ?? "Anonymous",
      uploader: userInfo?.name ?? "Anonymous",
      uploaderId: userInfo?.userId,
      editable: true,
      collectionId: shouldCopyAttributes()
        ? existingCollection.attributes?.collectionId
        : undefined,
      revisionId: shouldCopyAttributes()
        ? existingCollection.attributes?.revisionId
        : undefined,
      collectionSlug: shouldCopyAttributes()
        ? existingCollection.attributes?.collectionSlug
        : undefined,
      revisionNumber: shouldCopyAttributes()
        ? existingCollection.attributes?.revisionNumber + 1
        : undefined,
      collection: deduceCollectionAttributes(
        existingCollection,
        collection,
        mods,
      ),
      ...ownCollectionAttributes,
    },
    installationPath: id,
    rules: existingCollection.rules.filter(ruleFilter).map(ruleSimplify),
  };

  try {
    await new Promise<void>((resolve, reject) => {
      api.events.emit("create-mod", gameId, mod, (error: Error) => {
        if (error !== null) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    const deployPath = selectors.installPathForGame(state, gameId);
    const sourcePath = path.join(deployPath, sourceId);
    const clonePath = path.join(deployPath, id);
    const files: string[] = await fs.readdirAsync(sourcePath);
    for (const file of files) {
      await fs.copyAsync(
        path.join(sourcePath, file),
        path.join(clonePath, file),
      );
    }

    const exts: IExtensionFeature[] = findExtensions(api.getState(), gameId);

    for (const ext of exts) {
      if (ext.clone !== undefined) {
        await ext.clone(gameId, collection, existingCollection, mod);
      }
    }

    return id;
  } catch (err) {
    api.showErrorNotification("Failed to clone collection", err);
    return undefined;
  }
}
