/* eslint-disable */
import {
  BUNDLED_PATH,
  MAX_COLLECTION_NAME_LENGTH,
  MIN_COLLECTION_NAME_LENGTH,
  MOD_TYPE,
  PATCHES_PATH,
} from "../constants";
import {
  ICollection,
  ICollectionAttributes,
  ICollectionInfo,
  ICollectionMod,
  ICollectionModRule,
  ICollectionModRuleEx,
  ICollectionSourceInfo,
} from "../types/ICollection";

import { scanForDiffs } from "./binaryPatching";
import { findExtensions, IExtensionFeature } from "./extension";
import { generateGameSpecifics } from "./gameSupport";
import { generateConfig } from "./collectionConfig";
import { hasEditPermissions, renderReference, ruleId } from "./util";

import * as _ from "lodash";
import { ILookupResult } from "modmeta-db";
import * as path from "path";
import * as Redux from "redux";
import { generate as shortid } from "shortid";
import turbowalk, { IEntry } from "turbowalk";
import { actions, fs, log, selectors, types, util } from "vortex-api";
import { IINITweak } from "../types/IINITweak";

import { fileMD5Async } from "./util";

import { matchChecksums } from "./checksumMatcher";

import { importTweaks } from "../initweaks";
import { ReplicateHashMismatchError } from "./errors";

interface IResolvedRule {
  mod: types.IMod;
  rule: types.IModRule;
}

function sanitizeExpression(fileName: string): string {
  // drop extension and anything like ".1" or " (1)" at the end which probaby
  // indicates duplicate downloads (either in our own format or common browser
  // style)
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/\.\d+$/, "")
    .replace(/ \(\d+\)$/, "");
}

function toInt(input: string | number | undefined | null) {
  if (!input) {
    return 0;
  }

  if (typeof input === "string") {
    return parseInt(input, 10);
  }

  return input;
}

function deduceSource(
  mod: types.IMod,
  sourceInfo: ICollectionSourceInfo,
  versionMatcher: string,
  metaInfo: ILookupResult[],
  tag: string,
): ICollectionSourceInfo {
  const res: Partial<ICollectionSourceInfo> =
    sourceInfo !== undefined ? { ...sourceInfo } : { type: "nexus" };

  const assign = (obj: any, key: string, value: any) => {
    if (obj[key] === undefined) {
      obj[key] = value;
    }
  };

  if (res.type === "nexus") {
    if (mod.attributes?.source !== "nexus") {
      throw new Error(
        `"${util.renderModName(mod)}" doesn't have Nexus as its source`,
      );
    }
    const modId =
      mod.type === MOD_TYPE
        ? mod.attributes?.collectionId
        : mod.attributes?.modId;
    const fileId =
      mod.type === MOD_TYPE
        ? mod.attributes?.revisionId
        : mod.attributes?.fileId;
    // don't accept undefined, 0 or ''
    if (!modId || !fileId || isNaN(modId) || isNaN(fileId)) {
      throw new Error(`"${mod.id}" is missing mod id or file id`);
    }

    res.modId = toInt(modId);
    res.fileId = toInt(fileId);
  } else {
    assign(res, "adultContent", sourceInfo?.adultContent);
  }

  if (["browse", "direct"].includes(res.type) && !res.url) {
    throw new Error(`"${mod.id}" has no URL set`);
  }

  // since we store bundled mods uncompressed the md5 hash won't be the same
  if (sourceInfo?.type !== "bundle") {
    assign(res, "md5", mod.attributes?.fileMD5);
  }
  assign(res, "fileSize", mod.attributes?.fileSize);
  // prefering the logical name from the meta db because on imported files, the file may
  // have been renamed before installation
  assign(
    res,
    "logicalFilename",
    metaInfo?.[0]?.value?.logicalFileName ?? mod.attributes?.logicalFileName,
  );
  if (sourceInfo?.updatePolicy !== undefined) {
    assign(res, "updatePolicy", sourceInfo.updatePolicy);
  } else if (sourceInfo?.type === "bundle") {
    assign(res, "updatePolicy", "exact");
  } else {
    if (versionMatcher === "*") {
      assign(res, "updatePolicy", "latest");
    } else if (
      versionMatcher === undefined ||
      versionMatcher.endsWith("+prefer")
    ) {
      assign(res, "updatePolicy", "prefer");
    } else {
      assign(res, "updatePolicy", "exact");
    }
  }

  if (
    res.md5 === undefined &&
    res.logicalFilename === undefined &&
    res.fileExpression === undefined &&
    mod.attributes?.fileName !== undefined
  ) {
    assign(res, "fileExpression", sanitizeExpression(mod.attributes.fileName));
  }

  assign(res, "tag", tag);

  return res as ICollectionSourceInfo;
}

export function generateCollection(
  info: ICollectionInfo,
  mods: ICollectionMod[],
  modRules: ICollectionModRule[],
): ICollection {
  return {
    info,
    mods,
    modRules,
  };
}

/**
 * converts the rules in a mod into mod entries for a collection, ready for export
 */
async function rulesToCollectionMods(
  api: types.IExtensionApi,
  collection: types.IMod,
  resolvedRules: IResolvedRule[],
  mods: { [modId: string]: types.IMod },
  stagingPath: string,
  game: types.IGame,
  collectionInfo: ICollectionAttributes,
  bundleTags: { [modId: string]: string },
  onProgress: (percent: number, text: string) => void,
  onError: (message: string, replace: any, mayIgnore: boolean) => void,
): Promise<ICollectionMod[]> {
  let total = resolvedRules.length;

  let finished = 0;

  const collectionPath = path.join(stagingPath, collection.installationPath);
  await fs.removeAsync(path.join(collectionPath, BUNDLED_PATH));
  await fs.removeAsync(path.join(collectionPath, PATCHES_PATH));
  await fs.ensureDirAsync(path.join(collectionPath, BUNDLED_PATH));
  await fs.ensureDirAsync(path.join(collectionPath, PATCHES_PATH));

  const state = api.getState();
  const downloads = state.persistent.downloads.files;
  const downloadPath = selectors.downloadPathForGame(state, game.id);

  const fileOverridesIds = new Set(
    Object.keys(collectionInfo.fileOverrides ?? {}).filter(
      (modId) => collectionInfo.fileOverrides[modId],
    ),
  );

  const result: ICollectionMod[] = await Promise.all(
    resolvedRules.map(async (resolvedRule) => {
      const { mod, rule } = resolvedRule;

      const fileName = downloads[mod.archiveId]?.localPath;

      // we can't store the md5 hash for a bundled file because they are recompressed
      // during collection install and then the hash won't match
      const refMD5: string =
        collectionInfo.source?.[mod.id]?.type === "bundle"
          ? undefined
          : mod.attributes?.fileMD5;

      const meta = await api.lookupModMeta({
        fileName,
        filePath:
          fileName !== undefined
            ? path.join(downloadPath, fileName)
            : undefined,
        fileMD5: refMD5,
        fileSize: mod.attributes?.fileSize,
        gameId: game.id,
      });

      const modName = util.renderModName(mod, { version: false });
      try {
        // This call is relatively likely to fail to do it before the hash calculation to
        // save the user time in case it does fail
        const source = deduceSource(
          mod,
          collectionInfo.source?.[mod.id],
          rule.reference.versionMatch,
          meta,
          bundleTags[mod.id],
        );

        let hashes: any;
        let choices: any;

        let entries: IEntry[] = [];

        const installMode: string =
          collectionInfo.installMode?.[mod.id] ?? "fresh";

        const modPath = path.join(stagingPath, mod.installationPath);

        if (installMode === "clone") {
          await matchChecksums(api, game.id, mod.id);
          await turbowalk(
            modPath,
            async (input) => {
              entries = [].concat(entries, input);
            },
            {},
          );

          hashes = await Promise.all(
            entries
              .filter((iter) => !iter.isDirectory)
              .map(async (iter) => ({
                path: path.relative(modPath, iter.filePath),
                md5: await fileMD5Async(iter.filePath),
              })),
          );

          onProgress(undefined, modName);

          ++finished;
        } else if (installMode === "choices") {
          choices = mod?.attributes?.installerChoices;
          --total;
        } else {
          --total;
        }

        let patches: { [filePath: string]: string };
        if (collectionInfo.saveEdits?.[mod.id] === true) {
          const destPath = path.join(collectionPath, PATCHES_PATH, modName);
          await fs.ensureDirWritableAsync(destPath);
          patches = await scanForDiffs(
            api,
            game.id,
            mod.id,
            destPath,
            onProgress,
          );
        }

        if (collectionInfo.source?.[mod.id]?.type === "bundle") {
          const tlFiles = await fs.readdirAsync(modPath);
          const generatedName: string = `Bundled - ${util.sanitizeFilename(util.renderModName(mod, { version: true }))}`;
          const destPath = path.join(
            collectionPath,
            BUNDLED_PATH,
            generatedName,
          );
          try {
            await fs.removeAsync(destPath);
          } catch (err) {
            if (err.code !== "ENOENT") {
              throw err;
            }
          }
          await Promise.all(
            tlFiles.map(async (name) => {
              await fs.copyAsync(
                path.join(modPath, name),
                path.join(destPath, name),
              );
            }),
          );

          // update the source reference to match the actual bundled file
          source.fileExpression = generatedName;
          let totalSize: number = 0;
          await turbowalk(
            destPath,
            (items) =>
              (totalSize += items.reduce(
                (sub: number, entry) => sub + entry.size,
                0,
              )),
          );

          // source.fileSize = (await fs.statAsync(destPath)).size;
          source.fileSize = totalSize;
        }

        onProgress(Math.floor((finished / total) * 100), modName);

        const dlGame: types.IGame =
          mod.attributes?.downloadGame !== undefined
            ? util.getGame(mod.attributes.downloadGame)
            : game;

        // workaround where Vortex has no support for the game this download came from
        const domainName =
          dlGame !== undefined
            ? util.nexusGameId(dlGame)
            : mod.attributes?.downloadGame;

        const res: ICollectionMod = {
          name: modName,
          version: mod.attributes?.version ?? "1.0.0",
          optional: rule.type === "recommends",
          domainName,
          source,
          hashes,
          choices,
          patches,
          instructions: !!collectionInfo.instructions?.[mod.id]
            ? collectionInfo.instructions?.[mod.id]
            : undefined,
          author: mod.attributes?.author,
          details: {
            category: util.resolveCategoryName(mod.attributes?.category, state),
            type: mod.type,
          },
          phase: rule.extra?.["phase"] ?? 0,
          fileOverrides: fileOverridesIds.has(mod.id)
            ? mod.fileOverrides
            : undefined,
        };

        return res;
      } catch (err) {
        --total;

        onError(
          'failed to pack "{{modName}}": {{error}}',
          {
            modName,
            error: err.message,
            stack: err.stack,
          },
          err["mayIgnore"] ?? true,
        );

        if (err instanceof ReplicateHashMismatchError) {
          api.showDialog(
            "error",
            "Collection export failed",
            {
              bbcode:
                '"{{modName}}" cannot be exported using the replicate install mode.[br][/br][br][/br]The hashes of ' +
                "some of the files in your staging folder do not match the hashes of the files in the mod's " +
                "archive, which is guaranteed to cause issues for the end user.[br][/br][br][/br] Please consider using " +
                "binary patching or bundle your changes instead.",
              parameters: {
                modName: util.renderModName(mod),
              },
              options: {
                order: ["bbcode", "message"],
              },
            },
            [
              {
                label: "Close",
              },
            ],
            "replicate-hash-mismatch-error-dialog",
          );
        }

        return undefined;
      }
    }),
  );

  return result.filter(
    (mod) => mod !== undefined && Object.keys(mod.source).length > 0,
  );
}

export function makeBiDirRule(
  source: types.IModReference,
  rule: types.IModRule,
): ICollectionModRule {
  if (rule === undefined) {
    return undefined;
  }

  return {
    type: rule.type,
    reference: rule.reference,
    source,
  };
}

function makeTransferrable(
  mods: { [modId: string]: types.IMod },
  collection: types.IMod,
  rule: types.IModRule,
): types.IModRule {
  let newRef: types.IModReference = { ...rule.reference };
  const mod = util.findModByRef(rule.reference, mods);

  if (
    rule.reference.fileMD5 === undefined &&
    rule.reference.logicalFileName === undefined &&
    rule.reference.fileExpression === undefined
  ) {
    // a rule that doesn't contain any of the above markers will likely not be able to match
    // anything on a different system

    if (rule.reference.id === undefined) {
      // rule unusable
      log(
        "warn",
        "invalid rule couldn't be included in the collection",
        JSON.stringify(rule),
      );
      return undefined;
    }

    if (mod === undefined) {
      log(
        "warn",
        "mod enabled in collection isn't installed",
        JSON.stringify(rule),
      );
      return undefined;
    }

    newRef = util.makeModReference(mod);
  }

  // ok, this gets a bit complex now. If the referenced mod gets updated, also make sure
  // the rules referencing it apply to newer versions
  if (mod !== undefined) {
    const mpRule = collection.rules.find((iter) =>
      util.testModReference(mod, iter.reference),
    );
    if (
      mpRule !== undefined &&
      (mpRule.reference.versionMatch === undefined ||
        mpRule.reference.versionMatch === "*" ||
        mpRule.reference.versionMatch.startsWith(">="))
    ) {
      newRef.versionMatch = "*";
    }
  }

  return {
    type: rule.type,
    fileList: rule.fileList,
    comment: rule.comment,
    reference: newRef,
  } as any;
}

function ruleEnabled(
  rule: ICollectionModRule,
  mods: { [modId: string]: types.IMod },
  collection: types.IMod,
) {
  if (rule === undefined) {
    return false;
  }

  const ruleEx: ICollectionModRuleEx = {
    ...rule,
    sourceName: renderReference(rule.source, mods),
    referenceName: renderReference(rule.reference, mods),
  };
  const id = ruleId(ruleEx);

  return collection.attributes?.collection?.rule?.[id] ?? true;
}

function extractModRules(
  collectionRules: IResolvedRule[],
  collection: types.IMod,
  mods: { [modId: string]: types.IMod },
  collectionAttributes: ICollectionAttributes,
  bundleTags: { [modId: string]: string },
): ICollectionModRule[] {
  // for each mod referenced by the collection, gather the (enabled) rules and transform
  // them such that they can be applied on the users system
  return (
    collectionRules
      .reduce((prev: ICollectionModRule[], resolvedRule: IResolvedRule) => {
        const { mod } = resolvedRule;
        const source: types.IModReference = util.makeModReference(mod);
        const sourceOrig = JSON.parse(JSON.stringify(source));

        // ok, this gets a bit complex now. If the referenced mod gets updated, also make sure
        // the rules referencing it apply to newer versions
        const mpRule = collection.rules.find((iter) =>
          util.testModReference(mod, iter.reference),
        );
        if (
          mpRule !== undefined &&
          (mpRule.reference.versionMatch === undefined ||
            mpRule.reference.versionMatch === "*" ||
            mpRule.reference.versionMatch.startsWith(">="))
        ) {
          source.versionMatch = "*";
        }

        if (collectionAttributes.source?.[mod.id]?.type === "bundle") {
          source.fileMD5 = undefined;
          source.tag = bundleTags[mod.id];
        }

        // we're not including requires/recommends rules under the logic that if they were
        // required or recommended, the collection should be including them. Plus, based on (sensible)
        // user request, we're ignoring these during collection installation or else we'd be getting
        // tons of notifications during the installation.
        const includedRules = (mod.rules || []).filter(
          (rule) => !["requires", "recommends"].includes(rule.type),
        );

        return [].concat(
          prev,
          includedRules.map((input: types.IModRule): ICollectionModRule => {
            if (input.extra?.["automatic"] === true) {
              // don't add rules introduced from a remote source, the assumption being that they would be
              // added on the client system as well and might get updated
              return undefined;
            }
            const target: types.IModRule = JSON.parse(JSON.stringify(input));

            const targetRef = util.findModByRef(target.reference, mods);
            const targetId = targetRef?.id ?? target.reference.idHint;
            const targetRule = makeTransferrable(mods, collection, target);

            if (collectionAttributes.source?.[targetId]?.type === "bundle") {
              target.reference.fileMD5 = undefined;
              if (targetRule !== undefined) {
                targetRule.reference.tag = bundleTags[targetId];
              }
            }

            // for the purpose of finding out if the rule is enabled in the collection we have
            // to compare the references as they are locally. Yes, this is super awkward code...
            if (
              targetRule === undefined ||
              !ruleEnabled(
                makeBiDirRule(sourceOrig, targetRule),
                mods,
                collection,
              )
            ) {
              return undefined;
            }

            return makeBiDirRule(source, targetRule);
          }),
        );
      }, [])
      // throw out rules that couldn't be converted
      .filter((rule) => rule !== undefined)
  );
}

/**
 * convert a mod entry from a collection into a mod rule
 */
export function collectionModToRule(
  knownGames: types.IGameStored[],
  mod: ICollectionMod,
): types.IModRule {
  const downloadHint = ["manual", "browse", "direct"].includes(mod.source.type)
    ? {
        url: mod.source.url,
        instructions: mod.source.instructions,
        mode: mod.source.type,
      }
    : undefined;

  const coerced = util.coerceToSemver(mod.version);

  let versionMatch = !!coerced
    ? `>=${coerced ?? "0.0.0"}+prefer`
    : util.coerceToSemver(mod.version);

  const { updatePolicy } = mod.source;

  if (
    updatePolicy === "exact" ||
    mod.source.type === "bundle" ||
    mod.hashes !== undefined
  ) {
    versionMatch = !!coerced ? coerced : util.coerceToSemver(mod.version);
  } else if (updatePolicy === "latest") {
    versionMatch = "*";
  }

  // we can't use the md5 hash for a bundled file because they are recompressed
  // during collection install and then the hash won't match
  const refMD5: string =
    mod.source.type === "bundle" ? undefined : mod.source.md5;

  const fileExpression =
    updatePolicy === "exact" || mod.source.logicalFilename === undefined
      ? mod.source.fileExpression
      : undefined;

  const reference: types.IModReference = {
    description: mod.name,
    fileMD5: refMD5,
    gameId: util.convertGameIdReverse(knownGames, mod.domainName),
    fileSize: mod.source.fileSize,
    versionMatch,
    logicalFileName: mod.source.logicalFilename,
    fileExpression,
    tag: mod.source.tag ?? shortid(),
  };

  if (["latest", "prefer"].includes(updatePolicy)) {
    reference["md5Hint"] = mod.source.md5;
  }

  if (mod.source.type === "nexus") {
    if (!mod.source.modId || !mod.source.fileId) {
      const err = new Error("Invalid nexus repo specification");
      err["mod"] = mod;
      throw err;
    }
    reference["repo"] = {
      repository: "nexus",
      gameId: mod.domainName,
      modId: mod.source.modId.toString(),
      fileId: mod.source.fileId.toString(),
      campaign: "collection",
    } as any;
  }

  const res: types.IModRule = {
    type: mod.optional ? "recommends" : "requires",
    reference,
    fileList: mod.hashes,
    installerChoices: mod.choices,
    downloadHint,
    extra: {
      author: mod.author,
      type: mod.details?.type,
      category: mod.details?.category,
      version: mod.version,
      url: mod.source.url,
      name: mod.name,
      instructions: !!mod.instructions ? mod.instructions : undefined,
      phase: mod.phase ?? 0,
      patches: mod.patches,
      fileOverrides: mod.fileOverrides,
    },
  } as any;

  if (mod.source.type === "bundle") {
    res.extra.localPath = path.join("bundled", mod.source.fileExpression);
  }

  return res;
}

export async function modToCollection(
  api: types.IExtensionApi,
  gameId: string,
  stagingPath: string,
  collection: types.IMod,
  mods: { [modId: string]: types.IMod },
  onProgress: (percent?: number, text?: string) => void,
  onError: (message: string, replace: any, mayIgnore: boolean) => void,
): Promise<ICollection> {
  const state = api.getState();

  if (selectors.activeGameId(state) !== gameId) {
    // this would be a bug
    return Promise.reject(
      new Error("Can only export collection for the active profile"),
    );
  }

  const includedMods = (collection.rules as types.IModRule[])
    .map((rule) => {
      let id = rule.reference.id;
      if (id === undefined) {
        const mod = util.findModByRef(rule.reference, mods);
        if (mod !== undefined) {
          id = mod.id;
        }
      }
      return id;
    })
    .filter((id) => id !== undefined);

  const missing = includedMods.find((modId) => mods[modId] === undefined);
  if (missing !== undefined) {
    return Promise.reject(
      new Error("Can only export collections that are fully installed"),
    );
  }

  const exts: IExtensionFeature[] = findExtensions(state, gameId);
  const extData: any = {};
  for (const ext of exts) {
    Object.assign(
      extData,
      await ext.generate(gameId, includedMods, collection),
    );
  }

  const gameSpecific = await generateGameSpecifics(
    state,
    gameId,
    stagingPath,
    includedMods,
    mods,
  );

  const game = util.getGame(gameId);
  const discovery = selectors.discoveryByGame(state, gameId);

  const gameVersions =
    game !== undefined ? [await game.getInstalledVersion(discovery)] : [];

  const collectionAttributes = collection.attributes?.collection ?? {};
  const collectionConfig = await generateConfig({
    gameId,
    collectionMod: collection,
  });

  const collectionInfo: ICollectionInfo = {
    author: collection.attributes?.uploader ?? "Anonymous",
    authorUrl: collection.attributes?.authorURL ?? "",
    name: util.renderModName(collection),
    description: collection.attributes?.shortDescription ?? "",
    installInstructions: collectionAttributes.installInstructions ?? "",
    domainName: util.nexusGameId(game),
    gameVersions,
  };

  // we assign an id to each mod but we store them as tags in the collection only for bundled
  // mods atm because those are otherwise a bit unreliable to match rules to.
  // This might be counter-intuitive but the entire system for matching mods across systems
  // depends on mod meta information provided by the server or md5 hashes, both are not available
  // for bundled mods (server meta info for obvious reasons, md5 hashes because bundled mods have
  // to be unpacked so the nexus mods backend can virus scan the content)

  // The reason we're not using the tags for everything is that there is a chance
  // (miniscule but not 0) that different curators get the same ids generated by shortid.
  // we could be using uuid but then the tags would have a different format and it'd be a mess
  const bundleTags: { [modId: string]: string } = includedMods.reduce(
    (prev, modId) => {
      prev[modId] = shortid();
      return prev;
    },
    {},
  );

  const resolvedRules = collection.rules.reduce<IResolvedRule[]>(
    (prev, rule: types.IModRule) => {
      const mod =
        rule.reference.id !== undefined
          ? mods[rule.reference.id]
          : util.findModByRef(rule.reference, mods);

      if (mod === undefined) {
        onError(
          'Not packaging mod that isn\'t installed: "{{id}}"',
          { id: rule.reference.id },
          true,
        );
      } else if (mod.type === MOD_TYPE) {
        // don't include the collection itself (or any other collection for that matter,
        // nested collections aren't allowed)
      } else {
        prev.push({ mod, rule });
      }
      return prev;
    },
    [],
  );

  const modRules = extractModRules(
    resolvedRules,
    collection,
    mods,
    collectionAttributes,
    bundleTags,
  );

  const res: ICollection = {
    info: collectionInfo,
    mods: await rulesToCollectionMods(
      api,
      collection,
      resolvedRules,
      mods,
      stagingPath,
      game,
      collectionAttributes,
      bundleTags,
      onProgress,
      onError,
    ),
    modRules,
    ...extData,
    ...gameSpecific,
    collectionConfig: { ...collectionConfig },
  };

  return res;
}

async function createTweaksFromProfile(
  api: types.IExtensionApi,
  profile: types.IProfile,
  mods: { [modId: string]: types.IMod },
  existingId: string,
): Promise<IINITweak[]> {
  return importTweaks(
    api,
    profile,
    api.getState().persistent.mods[profile.gameId],
    api.getState().persistent.mods[profile.gameId]?.[existingId],
  );
}

function createRulesFromProfile(
  profile: types.IProfile,
  mods: { [modId: string]: types.IMod },
  existingRules: types.IModRule[],
  existingId: string,
  filterFunc: (mod: types.IMod) => boolean,
  isQuickCollection?: boolean,
): types.IModRule[] {
  return Object.keys(profile.modState ?? {})
    .filter(
      (modId) =>
        profile.modState?.[modId]?.enabled &&
        mods[modId] !== undefined &&
        modId !== existingId &&
        // no nested collections allowed
        mods[modId].type !== MOD_TYPE &&
        filterFunc(mods[modId]),
    )
    .map((modId) => {
      // don't forget what we set up regarding version matching
      let versionMatch: string;

      const oldRule = existingRules.find((iter) =>
        util.testModReference(mods[modId], iter.reference),
      );
      if (
        oldRule !== undefined &&
        oldRule.reference.versionMatch !== undefined
      ) {
        versionMatch =
          oldRule.reference.versionMatch === "*"
            ? "*"
            : mods[modId].attributes.version;
      }

      if (isQuickCollection) {
        versionMatch = mods[modId].attributes.version;
      }

      return {
        type: "requires",
        reference: {
          id: modId,
          archiveId: mods[modId].archiveId,
          versionMatch,
        },
      } as any;
    });
}

export function makeCollectionId(baseId: string): string {
  return `vortex_collection_${baseId}`;
}

function deduceCollectionAttributes(
  collectionMod: types.IMod,
  collection: ICollection,
  mods: { [modId: string]: types.IMod },
): ICollectionAttributes {
  const res: ICollectionAttributes = {
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
          : "fresh";

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

export async function createCollection(
  api: types.IExtensionApi,
  gameId: string,
  id: string,
  name: string,
  rules: types.IModRule[],
) {
  const state: types.IState = api.store.getState();

  const mod: types.IMod = {
    id,
    type: MOD_TYPE,
    state: "installed",
    attributes: {
      name,
      version: "0",
      installTime: new Date().toString(),
      author: state.persistent["nexus"]?.userInfo?.name ?? "Anonymous",
      uploader: state.persistent["nexus"]?.userInfo?.name ?? "Anonymous",
      uploaderId: state.persistent["nexus"]?.userInfo?.user_id,
      editable: true,
      source: "user-generated",
      recommendNewProfile: false,
    },
    installationPath: id,
    rules,
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
  } catch (err) {
    api.showErrorNotification("Failed to create collection", err);
  }
}

function updateCollection(
  api: types.IExtensionApi,
  gameId: string,
  mod: types.IMod,
  newRules: types.IModRule[],
) {
  api.store.dispatch(actions.setModAttribute(gameId, mod.id, "editable", true));

  const removedRules: types.IModRule[] = [];
  // remove rules not found in newRules
  util.batchDispatch(
    api.store,
    (mod.rules ?? []).reduce((prev: Redux.Action[], rule: types.IModRule) => {
      if (newRules.find((iter) => _.isEqual(rule, iter)) === undefined) {
        removedRules.push(rule);
        prev.push(actions.removeModRule(gameId, mod.id, rule));
      }
      return prev;
    }, []),
  );

  // add rules not found in the old list
  util.batchDispatch(
    api.store,
    newRules.reduce((prev: Redux.Action[], rule: types.IModRule) => {
      if (
        (mod.rules ?? []).find((iter) => _.isEqual(rule, iter)) === undefined
      ) {
        prev.push(actions.addModRule(gameId, mod.id, rule));
      }
      return prev;
    }, []),
  );
}

export function validateName(
  t: types.TFunction,
  content: types.IDialogContent,
): types.IConditionResult[] {
  const input = content.input[0].value || "";
  if (
    input.length >= MIN_COLLECTION_NAME_LENGTH &&
    input.length <= MAX_COLLECTION_NAME_LENGTH
  ) {
    return [];
  } else {
    return [
      {
        id: "name",
        errorText: t("Name must be between {{min}}-{{max}} characters long", {
          replace: {
            min: MIN_COLLECTION_NAME_LENGTH,
            max: MAX_COLLECTION_NAME_LENGTH,
          },
        }),
        actions: ["Create"],
      },
    ];
  }
}

export async function showQuickCollectionRestrictionsDialog(
  api: types.IExtensionApi,
) {
  const t = api.translate;
  const state: types.IState = api.store.getState();
  const profileId = selectors.activeProfile(state)?.id;
  if (!profileId) {
    return;
  }

  const restrictionsDialog = await api.showDialog(
    "info",
    "Quick Collection",
    {
      bbcode: t(
        "Quick Collections create a backup of your mod list for easy import by another PC or mod manager. " +
          'They can be created in a few clicks but do not include all the features of a "full" collection.[br][/br][br][/br]' +
          "Your Quick Collection will include:[br][/br]" +
          "[list]" +
          "[*] All mods downloaded from Nexus Mods that are currently enabled and deployed." +
          "[*] Installer choices for mods that support installers (such as FOMODs)." +
          "[*] File conflict rules." +
          "[*] Load order rules." +
          "[/list][br][/br]" +
          "Quick Collections do NOT include:[br][/br]" +
          "[list]" +
          "[*] Mods from sources other than Nexus Mods." +
          "[*] Alterations you have made mods after installing them." +
          "[*] Outputs of automated tools generated on your PC (FNIS, Script Merger, etc)." +
          "[*] Mods that you have created on your PC and added to Vortex." +
          "[/list][br][/br]" +
          "If you are using this feature migrate your mod list to the Nexus Mods app, see the " +
          `[url=https://nexus-mods.github.io/NexusMods.App/users/gettingstarted/MovingToTheApp/]full guide here.[/url]`,
      ),
    },
    [{ label: "Cancel" }, { label: "Proceed" }],
  );
  return restrictionsDialog.action === "Cancel"
    ? Promise.reject(new util.UserCanceled())
    : Promise.resolve();
}

interface ICreateCollectionFromProfileResult {
  id: string;
  name: string;
  updated: boolean;
  wantsToUpload: boolean;
}

export async function createCollectionFromProfile(
  api: types.IExtensionApi,
  profileId: string,
  forceName?: string,
): Promise<ICreateCollectionFromProfileResult> {
  const state: types.IState = api.store.getState();
  const profile = state.persistent.profiles[profileId];

  const isQuickCollection = forceName !== undefined;
  const id = isQuickCollection
    ? makeCollectionId(`${profileId}_${shortid()}`)
    : makeCollectionId(profileId);

  const mod: types.IMod = state.persistent.mods[profile.gameId]?.[id];

  const isNexusSourced = (m: types.IMod) => m?.attributes?.source === "nexus";
  const isGeneratedMod = (m: types.IMod) => m?.attributes?.generated === true;
  const filterFunc = (m: types.IMod) =>
    forceName ? isNexusSourced(m) && !isGeneratedMod(m) : true;
  const rules = createRulesFromProfile(
    profile,
    state.persistent.mods[profile.gameId] ?? {},
    mod?.rules ?? [],
    mod?.id,
    filterFunc,
    isQuickCollection,
  );

  let name: string = forceName ?? profile.name;

  const uploadLabel = "Create and Upload";
  let wantsToUpload = false;
  if (mod === undefined) {
    const t = api.translate;
    const result = await api.showDialog(
      "question",
      "New collection from profile",
      {
        text: "Create a collection containing the mods enabled in your current profile.",
        input: [
          {
            id: "name",
            label: "Please enter a name for your new collection",
            type: "text",
            value: name,
          },
        ],
        condition: (content) => validateName(t, content),
      },
      [
        { label: "Cancel" },
        { label: forceName ? uploadLabel : "Create", default: true },
      ],
    );

    const cancelled = result.action === "Cancel";
    if (cancelled) {
      throw new util.UserCanceled();
    }

    wantsToUpload = result.action === uploadLabel;

    name = result.input["name"];
    await createCollection(api, profile.gameId, id, name, rules);
    await createTweaksFromProfile(
      api,
      profile,
      state.persistent.mods[profile.gameId] ?? {},
      id,
    );
  } else {
    name = mod.attributes?.name;
    updateCollection(api, profile.gameId, mod, rules);
  }

  return { id, name, updated: mod !== undefined, wantsToUpload };
}
