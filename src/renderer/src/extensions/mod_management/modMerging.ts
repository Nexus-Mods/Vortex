import { getErrorCode, unknownToError } from "@vortex/shared";
import * as crypto from "crypto";
import * as path from "path";

import type {
  IDeployedFile,
  IExtensionApi,
} from "../../types/IExtensionContext";
import type { IGame } from "../../types/IGame";
import type { IFileEntry } from "../../util/getFileList";
import type { Normalize } from "../../util/getNormalizeFunc";
import type { IMod } from "./types/IMod";
import type { IResolvedMerger } from "./types/IResolvedMerger";

import { log } from "../../logging";
import * as fs from "../../util/fs";
import getFileList from "../../util/getFileList";
import getNormalizeFunc from "../../util/getNormalizeFunc";
import { setdefault, truthy } from "../../util/util";
import walk from "../../util/walk";
import { BACKUP_TAG } from "./LinkingDeployment";

export const MERGED_PATH = "__merged";

function calcHashImpl(filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filePath);
    stream.on("readable", () => {
      const data = stream.read();
      if (data) {
        hash.update(data);
      }
    });
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function calcHash(filePath: string, tries: number = 3): Promise<string> {
  return calcHashImpl(filePath).catch((err) => {
    const code = getErrorCode(err);
    if (code !== null && ["EMFILE", "EBADF"].includes(code) && tries > 0) {
      return calcHash(filePath, tries - 1);
    } else {
      return Promise.reject(unknownToError(err));
    }
  });
}

async function mergeArchive(
  api: IExtensionApi,
  game: IGame,
  relArcPath: string,
  basePath: string,
  sources: string[],
  mergePath: string,
) {
  const baseContent: { [path: string]: { size: number; hash: string } } = {};
  const resultPath = path.join(mergePath, "result");
  log("debug", "merging archive", relArcPath);

  await fs.ensureDirAsync(resultPath);

  let sourcePath: string;
  try {
    await fs.statAsync(path.join(basePath, relArcPath) + BACKUP_TAG);
    sourcePath = path.join(basePath, relArcPath) + BACKUP_TAG;
  } catch {
    sourcePath = path.join(basePath, relArcPath);
  }

  try {
    const archive = await api.openArchive(
      sourcePath,
      { gameId: game.id },
      path.extname(relArcPath).substr(1),
    );
    await archive.extractAll(resultPath);
    await walk(resultPath, (iterPath, stats) =>
      stats.isDirectory()
        ? Promise.resolve()
        : calcHash(iterPath).then((hash) => {
            baseContent[path.relative(resultPath, iterPath)] = {
              size: stats.size,
              hash,
            };
          }),
    );
  } catch (err) {
    if (getErrorCode(err) !== "ENOENT") {
      throw err;
    }
  }

  for (const modPath of sources) {
    const outputPath = path.join(mergePath, path.basename(modPath));
    await fs.ensureDirAsync(outputPath);
    const archive = await api.openArchive(path.join(modPath, relArcPath));
    await archive.extractAll(outputPath);
    await walk(outputPath, (iterPath, stats) => {
      if (stats.isDirectory()) {
        return;
      }
      const relPath = path.relative(outputPath, iterPath);
      let isDifferentProm: Promise<boolean>;
      if (
        baseContent[relPath] === undefined ||
        stats.size !== baseContent[relPath].size
      ) {
        isDifferentProm = Promise.resolve(true);
      } else {
        isDifferentProm = calcHash(iterPath).then(
          (hash) => hash !== baseContent[relPath].hash,
        );
      }
      return isDifferentProm.then((different) =>
        different
          ? fs.moveAsync(iterPath, path.join(resultPath, relPath), {
              overwrite: true,
            })
          : Promise.resolve(),
      );
    });
    await fs.removeAsync(outputPath);
  }

  const finalArchive = await api.openArchive(
    path.join(mergePath, relArcPath),
    { gameId: game.id },
  );
  await finalArchive.create(resultPath);
  await fs.removeAsync(resultPath);
}

export interface IMergeResult {
  // lists the files (paths relative to the mod base directory) used in merging.
  // These files will not be deployed individually
  usedInMerge: string[];
  // this stores the mods that influenced the output of a merge
  mergeInfluences: {
    [outPath: string]: {
      modType: string;
      sources: string[];
    };
  };
}

async function mergeMods(
  api: IExtensionApi,
  game: IGame,
  modBasePath: string,
  destinationPath: string,
  mods: IMod[],
  deployedFiles: IDeployedFile[],
  mergers: IResolvedMerger[],
): Promise<IMergeResult> {
  const res: IMergeResult = {
    usedInMerge: [],
    mergeInfluences: {},
  };

  if (mergers.length === 0 && game.mergeArchive === undefined) {
    return res;
  }

  const mergeDest = path.join(modBasePath, MERGED_PATH);

  const archiveMerges: {
    [relPath: string]: Array<{ id: string; path: string }>;
  } = {};
  const fileExists = (file: string) =>
    fs
      .statAsync(file)
      .then(() => true)
      .catch(() => false);

  const isDeployed = (filePath: string) =>
    deployedFiles.find(
      (file) =>
        path.join(destinationPath, file.relPath).toLowerCase() ===
        filePath.toLowerCase(),
    ) !== undefined;

  for (const mod of mods.filter(
    (mod) => mod.installationPath !== undefined,
  )) {
    const modPath = path.join(modBasePath, mod.installationPath);
    const allFiles = await getFileList(modPath);
    const fileList = allFiles.filter(
      (entry: IFileEntry) => entry.stats.isFile(),
    );

    for (const fileEntry of fileList) {
      if (
        game.mergeArchive !== undefined &&
        game.mergeArchive(fileEntry.filePath)
      ) {
        const relPath = path.relative(modPath, fileEntry.filePath);
        res.usedInMerge.push(relPath);
        setdefault(archiveMerges, relPath, []).push({
          path: modPath,
          id: mod.id,
        });
      } else {
        const merger = mergers.find((iter) =>
          iter.match.filter(fileEntry.filePath),
        );
        if (merger !== undefined) {
          const realDest = truthy(merger.modType)
            ? mergeDest + "." + merger.modType
            : mergeDest;
          const relPath = path.relative(modPath, fileEntry.filePath);
          res.usedInMerge.push(relPath);
          const normalize: Normalize = await getNormalizeFunc(modPath);
          await fs.ensureDirAsync(realDest);

          for (const file of merger.match.baseFiles(deployedFiles)) {
            const norm = normalize(file.out);
            setdefault(res.mergeInfluences, norm, {
              modType: merger.modType,
              sources: [],
            }).sources.push(mod.id);

            if (res.mergeInfluences[norm].sources.length !== 1) {
              continue;
            }

            const statRes = await Promise.all([
              fileExists(file.in),
              fileExists(file.in + BACKUP_TAG),
            ]);

            if (statRes[1]) {
              await fs.copyAsync(
                file.in + BACKUP_TAG,
                path.join(realDest, file.out),
              );
            } else if (statRes[0]) {
              if (isDeployed(file.in)) {
                await fs.removeAsync(file.in);
              } else {
                const outPath = path.join(realDest, file.out);
                try {
                  await fs.removeAsync(outPath);
                } catch {
                  // ignore
                }
                await fs.ensureDirAsync(path.dirname(outPath));
                try {
                  await fs.copyAsync(file.in, outPath);
                } catch (err) {
                  if (getErrorCode(err) === "ENOENT") {
                    log(
                      "error",
                      "file not found upon copying merge base file",
                      {
                        source: file.in,
                        destination: outPath,
                      },
                    );
                  }
                  throw err;
                }
              }
            }
          }

          await merger.merge(fileEntry.filePath, realDest);
        }
      }
    }
  }

  for (const relPath of Object.keys(archiveMerges)) {
    await mergeArchive(
      api,
      game,
      relPath,
      destinationPath,
      archiveMerges[relPath].map((iter) => iter.path),
      mergeDest,
    );
    const normalize = await getNormalizeFunc(destinationPath);
    setdefault(res.mergeInfluences, normalize(relPath), {
      modType: "",
      sources: archiveMerges[relPath].map((iter) => iter.id),
    });
  }

  return res;
}

export default mergeMods;
