import { BUNDLED_PATH, PATCHES_PATH } from "./constants";
import {
  ICollection,
  ICollectionMod,
  ICollectionSourceInfo,
} from "./types/ICollection";
import { modToCollection as modToCollection } from "./util/transformCollection";
import { hasEditPermissions, makeProgressFunction } from "./util/util";

import {
  ICreateCollectionResult,
  IGraphErrorDetail,
} from "@nexusmods/nexus-api";
import Bluebird from "bluebird";
import * as _ from "lodash";
import Zip = require("node-7z");
import * as path from "path";
import { dir as tmpDir } from "tmp";
import { actions, fs, log, selectors, types, util } from "vortex-api";

async function withTmpDir(
  cb: (tmpPath: string) => Promise<void>,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tmpDir((err, tmpPath, cleanup) => {
      if (err !== null) {
        return reject(err);
      } else {
        cb(tmpPath)
          .then(() => {
            resolve();
          })
          .catch((tmpErr) => {
            reject(tmpErr);
          })
          .finally(() => {
            try {
              cleanup();
            } catch (err) {
              // cleanup failed
              log("warn", "Failed to clean up temp file", { path, err });
            }
          });
      }
    });
  });
}

async function zip(zipPath: string, sourcePath: string): Promise<void> {
  const zipper = new Zip();
  const files = await fs.readdirAsync(sourcePath);
  await zipper.add(
    zipPath,
    files.map((fileName) => path.join(sourcePath, fileName)),
  );
}

async function generateCollectionInfo(
  api: types.IExtensionApi,
  gameId: string,
  collection: types.IMod,
  progress: (percent: number, text: string) => void,
  error: (message: string, replace: any, mayIgnore: boolean) => void,
): Promise<ICollection> {
  const state = api.getState();
  const mods = state.persistent.mods[gameId];
  const stagingPath = selectors.installPath(state);
  return modToCollection(
    api,
    gameId,
    stagingPath,
    collection,
    mods,
    progress,
    error,
  );
}

async function writeCollectionToFile(
  state: types.IState,
  info: ICollection,
  mod: types.IMod,
  outputPath: string,
) {
  await fs.ensureDirWritableAsync(outputPath, () => Bluebird.resolve());

  await fs.writeFileAsync(
    path.join(outputPath, "collection.json"),
    JSON.stringify(info, undefined, 2),
  );

  const stagingPath = selectors.installPath(state);
  const modPath = path.join(stagingPath, mod.installationPath);

  try {
    const tweaks = mod.enabledINITweaks ?? [];
    for (const tweak of tweaks) {
      await fs.copyAsync(
        path.join(modPath, "INI Tweaks", tweak),
        path.join(outputPath, "INI Tweaks", tweak),
      );
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    } // else: no ini tweak, no problem
  }

  await fs.copyAsync(
    path.join(modPath, BUNDLED_PATH),
    path.join(outputPath, BUNDLED_PATH),
  );
  await fs.copyAsync(
    path.join(modPath, PATCHES_PATH),
    path.join(outputPath, PATCHES_PATH),
  );

  const zipPath = path.join(
    modPath,
    "export",
    `collection_${mod.attributes?.version ?? "0"}.7z`,
  );
  try {
    await fs.removeAsync(zipPath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
  await zip(zipPath, outputPath);
  await fs.removeAsync(outputPath);
  return zipPath;
}

function filterInfoModSource(
  source: ICollectionSourceInfo,
): ICollectionSourceInfo {
  return _.omit(source, ["instructions", "fileSize", "tag"]);
}

function filterInfoMod(mod: ICollectionMod): ICollectionMod {
  const res = _.omit(mod, [
    "hashes",
    "choices",
    "patches",
    "details",
    "instructions",
    "phase",
    "fileOverrides",
  ]);
  res.source = filterInfoModSource(res.source);
  return res;
}

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
      ? RecursivePartial<T[P]>
      : T[P];
};

function filterInfo(input: ICollection): RecursivePartial<ICollection> {
  const info = _.omit(input.info, ["installInstructions"]);
  return {
    info,
    mods: input.mods.map((mod) => filterInfoMod(mod)),
  };
}

async function queryErrorsContinue(
  api: types.IExtensionApi,
  errors: Array<{ message: string; replace: any }>,
) {
  const res = await api.showDialog(
    "error",
    "Errors creating collection",
    {
      text: "There were errors creating the collection, do you want to proceed anyway?",
      message: errors
        .map((err) => api.translate(err.message, { replace: err.replace }))
        .join("\n"),
    },
    [{ label: "Cancel" }, { label: "Continue" }],
  );

  if (res.action === "Cancel") {
    throw new util.UserCanceled();
  }
}

function renderGraphLocateError(
  api: types.IExtensionApi,
  gameId: string,
  modId: string,
  det: IGraphErrorDetail,
): string {
  const t = api.translate;
  const state = api.getState();
  const mods = state.persistent.mods[gameId];
  switch (det.attribute) {
    case "modId": {
      const missingMod = Object.values(mods).find(
        (iter) => iter.attributes?.modId?.toString?.() === det.value.toString(),
      );
      if (missingMod !== undefined) {
        return t(
          "Mod not found on nexusmods.com: {{modName}} (modId: {{modId}}), " +
            "it may have been removed.",
          {
            replace: {
              modName: util.renderModName(missingMod),
              modId: det.value,
            },
          },
        );
      } else {
        return t("Mod with id {{modId}} not found", {
          replace: { modId: det.value },
        });
      }
    }
    case "fileId": {
      const missingMod = Object.values(mods).find(
        (iter) =>
          iter.attributes?.fileId?.toString?.() === det.value.toString(),
      );
      if (missingMod !== undefined) {
        return t(
          "Mod not found on nexusmods.com: {{modName}} " +
            "(modId: {{modId}}, fileId: {{fileId}}), " +
            "it may have been removed.",
          {
            replace: {
              modName: util.renderModName(missingMod, { version: true }),
              modId: missingMod.attributes?.modId ?? "Unknown",
              fileId: missingMod.attributes?.fileId,
            },
          },
        );
      } else {
        return t("Mod with file id {{fileId}} not found", {
          replace: { fileId: det.value },
        });
      }
    }
    default: {
      return det.message;
    }
  }
}

function renderGraphErrorFallback(
  message: string,
  det: IGraphErrorDetail,
): string {
  return det.message || message;
}

function renderGraphErrorDetail(
  api: types.IExtensionApi,
  gameId: string,
  modId: string,
  message: string,
  det: IGraphErrorDetail,
): string {
  if (det.type === "LOCATE_ERROR" && !!det.value) {
    return renderGraphLocateError(api, gameId, modId, det);
  } else {
    return renderGraphErrorFallback(message, det);
  }
}

export async function doExportToAPI(
  api: types.IExtensionApi,
  gameId: string,
  modId: string,
  uploaderName: string,
): Promise<{ slug: string; revisionNumber: number }> {
  const state: types.IState = api.store.getState();
  const mod = state.persistent.mods[gameId][modId];

  const { progress, progressEnd } = makeProgressFunction(api);

  const errors: Array<{ message: string; replace: any }> = [];

  let mayIgnore: boolean = true;

  const onError = (message: string, replace: any, allowIgnore: boolean) => {
    errors.push({ message, replace });
    mayIgnore &&= allowIgnore;
  };

  let info: ICollection;

  let collectionId: number;
  let collectionSlug: string;
  let revisionNumber: number;

  try {
    info = await generateCollectionInfo(api, gameId, mod, progress, onError);
    if (errors.length > 0) {
      if (mayIgnore) {
        await queryErrorsContinue(api, errors);
      } else {
        throw new util.UserCanceled();
      }
    }
    await withTmpDir(async (tmpPath) => {
      const filePath = await writeCollectionToFile(state, info, mod, tmpPath);
      collectionId = mod.attributes?.collectionId ?? undefined;
      // collection api doesn't (currently) distinguish between uploader & author so
      // the expectation is that the fields contain the same value anyway
      const modUploader = mod.attributes?.uploader ?? mod.attributes?.author;
      if (
        collectionId !== undefined &&
        modUploader !== uploaderName &&
        !hasEditPermissions(mod.attributes?.permissions)
      ) {
        log(
          "info",
          "user doesn't match original author, creating new collection",
        );
        collectionId = undefined;
      }
      const result: ICreateCollectionResult = await util.toPromise((cb) =>
        api.events.emit(
          "submit-collection",
          filterInfo(info),
          filePath,
          collectionId,
          cb,
        ),
      );
      collectionId = result.collection.id;
      collectionSlug = result.collection.slug;
      api.store.dispatch(
        actions.setModAttribute(gameId, modId, "collectionId", collectionId),
      );
      api.store.dispatch(
        actions.setModAttribute(
          gameId,
          modId,
          "collectionSlug",
          result.collection.slug,
        ),
      );
      api.store.dispatch(
        actions.setModAttribute(gameId, modId, "source", "nexus"),
      );
      const revisionId = result.revision?.id ?? result["revisionId"];
      revisionNumber =
        result.revision?.revisionNumber ?? result["revisionNumber"];
      api.store.dispatch(
        actions.setModAttribute(gameId, modId, "revisionId", revisionId),
      );
      api.store.dispatch(
        actions.setModAttribute(
          gameId,
          modId,
          "revisionNumber",
          revisionNumber,
        ),
      );
      api.store.dispatch(
        actions.setModAttribute(
          gameId,
          modId,
          "version",
          ((revisionNumber ?? 0) + 1).toString(),
        ),
      );
    });
    progressEnd();
  } catch (err) {
    progressEnd();
    if (err.name === "ModFileNotFound") {
      const file = info.mods.find((iter) => iter.source.fileId === err.fileId);
      api.sendNotification({
        type: "error",
        title:
          "The server can't find one of the files in the collection, " +
          "are mod id and file id for it set correctly?",
        message: file !== undefined ? file.name : `id: ${err.fileId}`,
      });
      throw new util.ProcessCanceled("Mod file not found");
    } else if (err.constructor.name === "ParameterInvalid") {
      api.sendNotification({
        type: "error",
        title: "The server rejected this collection",
        message: err.message || "<No reason given>",
      });
      throw new util.ProcessCanceled("collection rejected");
    } else if (err.constructor.name === "GraphError") {
      const message: string = err.message;
      const details: IGraphErrorDetail[] = err["details"] ?? [];
      api.sendNotification({
        type: "error",
        message: "The server rejected this collection",
        actions: [
          {
            title: "More",
            action: () => {
              api.showDialog(
                "error",
                "The server rejected this collection",
                {
                  text:
                    details.length === 0
                      ? message
                      : details
                          .map((detail) =>
                            renderGraphErrorDetail(
                              api,
                              gameId,
                              modId,
                              message,
                              detail,
                            ),
                          )
                          .join("\n"),
                },
                [{ label: "Close" }],
              );
            },
          },
        ],
      });
      throw new util.ProcessCanceled("collection rejected");
    } else if (err instanceof util.ProcessCanceled) {
      api.showErrorNotification("Failed to upload collection", err, {
        allowReport: false,
      });
    } else {
      throw err;
    }
  }

  return { slug: collectionSlug, revisionNumber };
}

export async function doExportToFile(
  api: types.IExtensionApi,
  gameId: string,
  modId: string,
) {
  const state: types.IState = api.store.getState();
  const mod = state.persistent.mods[gameId][modId];

  const { progress, progressEnd } = makeProgressFunction(api);

  const errors: Array<{ message: string; replace: any }> = [];

  const onError = (message: string, replace: any) => {
    errors.push({ message, replace });
  };

  try {
    const stagingPath = selectors.installPathForGame(state, gameId);
    const modPath = path.join(stagingPath, mod.installationPath);
    const outputPath = path.join(modPath, "build");
    const info = await generateCollectionInfo(
      api,
      gameId,
      mod,
      progress,
      onError,
    );
    const zipPath = await writeCollectionToFile(state, info, mod, outputPath);
    const dialogActions = [
      {
        title: "Open",
        action: () => {
          util
            .opn(path.join(stagingPath, mod.installationPath, "export"))
            .catch(() => null);
        },
      },
    ];

    if (errors.length > 0) {
      const li = (input: string) => `[*]${input}`;
      dialogActions.unshift({
        title: "Errors",
        action: () => {
          api.showDialog(
            "error",
            "Collection Export Errors",
            {
              bbcode:
                "[list]" +
                errors.map((err) =>
                  li(api.translate(err.message, { replace: err.replace })),
                ) +
                "[/list]",
            },
            [{ label: "Close" }],
          );
        },
      });
    }

    api.sendNotification({
      id: "collection-exported",
      title:
        errors.length > 0
          ? "Collection exported, there were errors"
          : "Collection exported",
      message: zipPath,
      type: errors.length > 0 ? "warning" : "success",
      actions: dialogActions,
    });
  } catch (err) {
    api.showErrorNotification("Failed to export collection", err);
  }
  progressEnd();
}
