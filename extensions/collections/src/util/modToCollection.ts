import {
  BUNDLED_PATH,
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
} from "../types/ICollection";

import { scanForDiffs } from "./binaryPatching";
import { matchChecksums } from "./checksumMatcher";
import { generateConfig } from "./collectionConfig";
import { ReplicateHashMismatchError } from "./errors";
import { findExtensions, IExtensionFeature } from "./extension";
import { generateGameSpecifics } from "./gameSupport";
import { renderReference } from "./renderReference";
import {
  deduceSource,
  makeBiDirRule,
  makeTransferrable,
} from "./transformCollection";
import { ruleId } from "./util";
import { fileMD5Async } from "./walk";

import * as path from "path";
import { generate as shortid } from "shortid";
import turbowalk, { IEntry } from "turbowalk";
import { fs, selectors, types, util } from "vortex-api";

interface IResolvedRule {
  mod: types.IMod;
  rule: types.IModRule;
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

  const { pluginRules, ...gameSpecificWithoutRules } = gameSpecific;
  const filteredGameSpecific = collectionConfig.excludePluginRules
    ? gameSpecificWithoutRules
    : gameSpecific;

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
    ...filteredGameSpecific,
    collectionConfig: { ...collectionConfig },
  };

  return res;
}
