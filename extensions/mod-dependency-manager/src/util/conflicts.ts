/* eslint-disable */
import { ConflictSuggestion, IConflict } from "../types/IConflict";
import { IModLookupInfo } from "../types/IModLookupInfo";
import isBlacklisted from "./blacklist";
import * as path from "path";
import turbowalk from "turbowalk";
import { log, types, util } from "vortex-api";

// using absolute paths for conflict detection is required to detect conflicts
// across mod types, but this causes various problems across the application
// that we would have to review with sufficient time before we can apply this.
// besides: just because we detect file conflicts doesn't mean we can actually
//   solve them. Currently mod types are still deployed one after the other so
//   setting install order rules between mods of different types doesn't have
//   the expected effect until the deployment system is overhauled.
const ABSOLUTE_PATHS: boolean = true;

interface IConflictInfo {
  mod: types.IMod;
  relPath: string;
  time: number;
}

interface IFileMap {
  [filePath: string]: IConflictInfo[];
}

function toLookupInfo(mod: types.IMod): IModLookupInfo {
  const attributes = mod.attributes || {};
  return {
    id: mod.id,
    fileMD5: attributes["fileMD5"],
    customFileName: attributes["customFileName"],
    fileName: attributes["fileName"],
    fileSizeBytes: attributes["fileSizeBytes"],
    logicalFileName: attributes["logicalFileName"],
    name: attributes["name"],
    referenceTag: attributes["referenceTag"],
    version:
      util.coerceToSemver(attributes["version"]) ?? attributes["version"],
  };
}

function makeGetRelPath(api: types.IExtensionApi, game: types.IGame) {
  const makeResolver = (
    basePath: string,
    mergeMods: boolean | ((mod: types.IMod) => string),
  ) => {
    if (typeof mergeMods === "boolean") {
      if (ABSOLUTE_PATHS) {
        return mergeMods
          ? () => basePath
          : (mod: types.IMod) => path.join(basePath, mod.id);
      } else {
        return mergeMods ? () => "" : (mod: types.IMod) => mod.id;
      }
    } else {
      return ABSOLUTE_PATHS
        ? (mod: types.IMod) => path.join(basePath, mergeMods(mod))
        : mergeMods;
    }
  };

  const state: types.IState = api.getState();
  const discovery = state.settings.gameMode.discovered[game.id];

  const modPaths = game.getModPaths(discovery.path);
  const modTypeResolver: { [modType: string]: (mod: types.IMod) => string } =
    Object.keys(modPaths).reduce((prev, modTypeId) => {
      if (modTypeId === "") {
        prev[modTypeId] = makeResolver(modPaths[modTypeId], game.mergeMods);
      } else {
        const modType = util.getModType(modTypeId);
        prev[modTypeId] = makeResolver(
          modPaths[modTypeId],
          modType?.options?.mergeMods ?? game.mergeMods,
        );
      }
      return prev;
    }, {});

  return (mod: types.IMod): string => {
    if (modTypeResolver[mod.type] === undefined) {
      const modType: types.IModType = util.getModType(mod.type);
      if (modType === undefined) {
        log("warn", "mod has invalid mod type", mod.type);
        // fall back to default resolver
        return modTypeResolver[""](mod);
      }
      modTypeResolver[mod.type] = makeResolver(
        modType.getPath(game),
        modType?.options?.mergeMods ?? game.mergeMods,
      );
    }

    return modTypeResolver[mod.type](mod);
  };
}

function getAllFiles(
  api: types.IExtensionApi,
  game: types.IGame,
  stagingPath: string,
  mods: types.IMod[],
  activator: types.IDeploymentMethod,
): Promise<IFileMap> {
  const files: IFileMap = {};

  const typeRelPath = makeGetRelPath(api, game);

  const consideredMods = mods.filter(
    (mod) => mod.installationPath !== undefined && mod.state === "installed",
  );

  return Promise.all(
    consideredMods.map((mod: types.IMod) => {
      const modPath = path.join(stagingPath, mod.installationPath);

      return turbowalk(
        modPath,
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isDirectory) {
              try {
                let relPath = path.relative(modPath, entry.filePath);
                if (activator !== undefined) {
                  relPath = activator.getDeployedPath(relPath);
                }
                relPath = path.join(typeRelPath(mod), relPath);

                const relPathL = relPath.toLowerCase();
                // when getDeployedPath actually renames the file it's possible to get multiple
                // entries with the same path from the same mod. We don't want those to be listed
                // as two entries, otherwise we might report a mod as conflicting with itself
                if (
                  files[relPathL] !== undefined &&
                  files[relPathL].find((iter) => iter.mod === mod) !== undefined
                ) {
                  return;
                }
                util
                  .setdefault(files, relPathL, [])
                  .push({ mod, relPath, time: entry.mtime });
              } catch (err) {
                log("error", "invalid file entry - what is this?", {
                  entry,
                  error: err.stack,
                });
              }
            }
          });
        },
        {},
      ).catch((err) => {
        if (!["ENOENT", "ENOTFOUND"].includes(err.code)) {
          return Promise.reject(err);
        }
        log("error", "Mod directory not found", {
          modDirectory: mod.installationPath,
          error: err.message,
        });
        return {};
      });
    }),
  ).then(() => files);
}

interface IConflictMap {
  [lhsId: string]: {
    [rhsId: string]: { files: string[]; suggestion: ConflictSuggestion };
  };
}

function getConflictMap(files: IFileMap, game: types.IGame): IConflictMap {
  const conflictFiles = Object.keys(files).filter(
    (filePath) =>
      files[filePath] !== undefined &&
      files[filePath].length > 1 &&
      !isBlacklisted(filePath, game),
  );

  const conflicts: IConflictMap = {};
  conflictFiles.forEach((fileKey) => {
    const file = files[fileKey];
    for (let i = 0; i < file.length; ++i) {
      for (let j = 0; j < file.length; ++j) {
        if (i !== j) {
          const suggestion =
            file[i].time < file[j].time
              ? "before"
              : file[i].time > file[j].time
                ? "after"
                : undefined;
          const entry = util.setdefault(
            util.setdefault(conflicts, file[i].mod.id, {}),
            file[j].mod.id,
            { files: [], suggestion: undefined },
          );
          entry.files.push(file[0].relPath);
          if (suggestion !== undefined) {
            if (entry.suggestion === undefined) {
              entry.suggestion = suggestion;
            } else if (
              entry.suggestion !== null &&
              entry.suggestion !== suggestion
            ) {
              entry.suggestion = null;
            }
          }
        }
      }
    }
  });
  return conflicts;
}

function findConflicts(
  api: types.IExtensionApi,
  game: types.IGame,
  stagingPath: string,
  mods: types.IMod[],
  activator: types.IDeploymentMethod,
): Promise<{ [modId: string]: IConflict[] }> {
  return getAllFiles(api, game, stagingPath, mods, activator).then(
    (files: IFileMap) => {
      const conflictMap = getConflictMap(files, game);
      const conflictsByMod: { [modId: string]: IConflict[] } = {};
      Object.keys(conflictMap).forEach((lhsId) => {
        Object.keys(conflictMap[lhsId]).forEach((rhsId) => {
          if (conflictsByMod[lhsId] === undefined) {
            conflictsByMod[lhsId] = [];
          }
          const mod = mods.find((iter) => iter.id === rhsId);
          if (mod !== undefined) {
            const entry = conflictMap[lhsId][rhsId];
            conflictsByMod[lhsId].push({
              otherMod: toLookupInfo(mod),
              files: entry.files,
              suggestion: entry.suggestion || null,
            });
          }
        });
      });
      return conflictsByMod;
    },
  );
}

export default findConflicts;
