import { NAMESPACE } from "./globals";

import Bluebird from "bluebird";
import * as path from "path";
import turbowalk, { IEntry } from "turbowalk";
import { fs, log, selectors, types, util } from "vortex-api";

interface IDeployment {
  [typeId: string]: types.IDeployedFile[];
}

interface ITree {
  owners: Set<string>;
  directories: { [name: string]: ITree };
  files: { [name: string]: types.IDeployedFile };
}

function addToTree(
  tree: ITree,
  filePath: string,
  entry?: types.IDeployedFile,
): ITree {
  if (entry !== undefined) {
    tree.owners.add(entry.source);
  }

  // Normalize path and filter out empty segments to prevent undefined tree nodes
  const segments = filePath.split(path.sep).filter((seg) => seg.length > 0);

  segments.forEach((iter: string, idx: number, arr: string[]) => {
    if (idx === arr.length - 1 && entry !== undefined) {
      tree.files[iter] = entry;
    } else {
      if (tree.directories[iter] === undefined) {
        tree.directories[iter] = {
          owners: new Set<string>([]),
          directories: {},
          files: {},
        };
      }
      tree = tree.directories[iter];
      if (entry !== undefined) {
        tree.owners.add(entry.source);
      }
    }
  });

  return tree;
}

function getTree(tree: ITree, dirPath: string, required: boolean): ITree {
  // Filter out empty segments to prevent lookup issues
  const segments = dirPath.split(path.sep).filter((seg) => seg.length > 0);
  for (const seg of segments) {
    const nextTree = tree.directories[seg];
    if (nextTree === undefined) {
      if (required) {
        return undefined;
      } else {
        return tree;
      }
    }
    tree = nextTree;
  }
  return tree;
}

function getFileList(basePath: string, tree: ITree): string[] {
  return [].concat(
    Object.keys(tree.files).map((fileName) => path.join(basePath, fileName)),
    ...Object.keys(tree.directories).map((dirName) =>
      getFileList(path.join(basePath, dirName), tree.directories[dirName]),
    ),
  );
}

async function snapshot(
  basePath: string,
  deployment: ITree,
): Promise<string[]> {
  const tree = getTree(deployment, basePath, true);
  const deploymentSet = new Set<string>(getFileList(basePath, tree));

  let vanillaFiles: string[] = [];
  try {
    await turbowalk(
      basePath,
      (entries: IEntry[]) => {
        vanillaFiles = [].concat(
          vanillaFiles,
          entries
            .filter(
              (entry) =>
                !entry.isDirectory && !deploymentSet.has(entry.filePath),
            )
            .map((entry) => path.relative(basePath, entry.filePath)),
        );
      },
      { recurse: true, details: false, skipLinks: true },
    );
  } catch (err) {
    if (err.code !== "ENOENT") {
      log("error", "Failed to snapshot directory", {
        path: basePath,
        error: err.message,
      });
    }
  }

  // I _think_ we have to sort here because the api doesn't promise a specific file
  // order, even though it's usually going to be alphabetical.
  return vanillaFiles.sort((lhs, rhs) => lhs.localeCompare(rhs));
}

async function saveSnapshot(filePath: string, data: any) {
  await fs.ensureDirWritableAsync(path.dirname(filePath));
  const before = Date.now();
  await (util as any).writeFileAtomic(
    filePath,
    JSON.stringify(data, undefined, 2),
  );
  log("info", "file list snapshot saved", {
    filePath,
    duration: Date.now() - before,
  });
}

function compareEntries(
  normalize: (input: string) => string,
  before: string[],
  after: string[],
) {
  const normCompare = (lhs, rhs) =>
    normalize(lhs).localeCompare(normalize(rhs));

  // we could be using _.differenceWith here but I think we can get better performance using the
  // knowledge that the lists are already sorted

  const added: string[] = [];
  const removed: string[] = [];

  let beforeIdx = 0;
  let afterIdx = 0;
  const beforeLength = before.length;
  const afterLength = after.length;

  while (beforeIdx < beforeLength && afterIdx < afterLength) {
    const comp = normCompare(before[beforeIdx], after[afterIdx]);
    if (comp === 0) {
      ++beforeIdx;
      ++afterIdx;
    } else if (comp < 0) {
      // name in the before-list is "smaller", meaning it doesn't exist in the after list
      removed.push(before[beforeIdx++]);
    } else {
      // name in the after-list is smaller, meaning it doesn't exist in the before list
      added.push(after[afterIdx++]);
    }
  }

  while (beforeIdx < beforeLength) {
    removed.push(before[beforeIdx++]);
  }

  while (afterIdx < afterLength) {
    after.push(after[afterIdx++]);
  }

  return {
    added,
    removed,
  };
}

async function consolidate(
  deployment: IDeployment,
  modPaths: { [typeId: string]: string },
): Promise<ITree> {
  const tree: ITree = {
    owners: new Set<string>([]),
    directories: {},
    files: {},
  };

  await Promise.all(
    Object.keys(modPaths).map(async (modType) => {
      const modTypeTree = addToTree(tree, modPaths[modType]);
      if (deployment[modType] !== undefined) {
        deployment[modType].forEach((deployed) => {
          addToTree(modTypeTree, deployed.relPath, deployed);
        });
      }
    }),
  );

  return tree;
}

function figureOutBasePaths(tree: ITree): string[] {
  const bases: string[] = [];

  // current logic: base paths is every directory that has contains files or
  // has no subdirectories.
  // This may miss cases where files are added to directories that previously
  // had no files at all but the alternative is to consider every directory
  // that has more than one subdirectory and that may lead to huuuuuuuge
  // snapshots (potentially even entire drives)

  const getBases = (current: ITree, basePath: string[]): string[] => {
    if (
      current === undefined ||
      Object.keys(current.files).length > 0 ||
      Object.keys(current.directories).length === 0
    ) {
      return [basePath.join(path.sep)];
    }

    return Object.keys(current.directories).reduce((agg, dirName) => {
      agg.push(
        ...getBases(current.directories[dirName], [].concat(basePath, dirName)),
      );
      return agg;
    }, []);
  };

  Object.keys(tree.directories).forEach((dirName) => {
    bases.push(...getBases(tree.directories[dirName], [dirName]));
  });

  return bases;
}

async function createSnapshot(
  api: types.IExtensionApi,
  profileId: string,
  deployment: IDeployment,
) {
  const state: types.IState = api.store.getState();
  const profile = selectors.profileById(state, profileId);

  const game = util.getGame(profile.gameId);
  const discovery = selectors.discoveryByGame(state, game.id);

  if (discovery?.path === undefined) {
    return undefined;
  }

  const modPaths = game.getModPaths(discovery.path);

  const fullDeployment =
    deployment !== undefined
      ? await consolidate(deployment, modPaths)
      : { owners: new Set<string>(), directories: {}, files: {} };
  const basePaths = figureOutBasePaths(fullDeployment);

  const roots: Array<{ basePath: string; entries: string[] }> = [];

  await Promise.all(
    basePaths.map(async (basePath) => {
      const entries = await snapshot(basePath, fullDeployment);
      log("debug", "snapshot generated", {
        path: basePath,
        fileCount: entries.length,
      });
      roots.push({ basePath, entries });
    }),
  );
  return roots;
}

async function checkForFileChanges(
  api: types.IExtensionApi,
  profileId: string,
  deployment: IDeployment,
) {
  const state: types.IState = api.store.getState();
  const profile = selectors.profileById(state, profileId);
  if (profile === undefined) {
    log("error", "event with invalid profile id", { profileId });
    return;
  }

  const game = util.getGame(profile.gameId);
  const discovery = selectors.discoveryByGame(state, game.id);

  if (discovery?.path === undefined) {
    return;
  }

  const modPaths = game.getModPaths(discovery.path);

  const snapshotPath = path.join(
    util.getVortexPath("userData" as any),
    game.id,
    "snapshots",
    "snapshot.json",
  );

  const fullDeployment = await consolidate(deployment, modPaths);

  const basePaths = figureOutBasePaths(fullDeployment);

  const roots: Array<{ basePath: string; entries: string[] }> = [];

  try {
    const oldSnapshot = JSON.parse(
      await fs.readFileAsync(snapshotPath, { encoding: "utf-8" }),
    );

    await Promise.all(
      basePaths.map(async (basePath) => {
        const oldEntries = oldSnapshot.find(
          (iter) => iter.basePath === basePath,
        );
        const entries = await snapshot(basePath, fullDeployment);

        if (oldEntries === undefined) {
          log("info", "no old entries for path", { basePath });
        } else {
          const normalize = await util.getNormalizeFunc(basePath, {
            relative: false,
            separators: false,
            unicode: false,
          });
          const { added, removed } = compareEntries(
            normalize,
            oldEntries.entries,
            entries,
          );
          const normTree = util.makeNormalizingDict(fullDeployment, normalize);
          const baseTree = getTree(normTree, basePath, true);
          if (added.length > 0) {
            await api.emitAndAwait(
              "added-files",
              profileId,
              added.map((filePath) => {
                const treeEntry = getTree(
                  baseTree,
                  path.dirname(filePath),
                  false,
                );
                return {
                  filePath: path.join(basePath, filePath),
                  candidates: Array.from(treeEntry.owners),
                };
              }),
            );
          }
          if (removed.length > 0) {
            await api.emitAndAwait(
              "removed-files",
              profileId,
              removed.map((filePath) => {
                const treeEntry = getTree(
                  baseTree,
                  path.dirname(filePath),
                  false,
                );
                return {
                  filePath: path.join(basePath, filePath),
                  candidates: Array.from(treeEntry.owners),
                };
              }),
            );
          }
        }

        roots.push({ basePath, entries });
      }),
    );

    await saveSnapshot(snapshotPath, roots);
  } catch (err) {
    if (err.code !== "ENOENT") {
      // previously generated an error notification but most of the time a
      // failure here isn't really a problem
      log("error", "Failed to check for added files", err.message);
    }
  }
}

async function doPreRemoveModCheck(
  api: types.IExtensionApi,
  gameId: string,
  modIds: string[],
) {
  const state = api.store.getState();
  const discovery = util.getSafe(
    state,
    ["settings", "gameMode", "discovered", gameId],
    undefined,
  );
  const game = util.getGame(gameId);
  if (game === undefined || discovery?.path === undefined) {
    // How?
    log("error", "Game no longer available", { gameId });
    return;
  }

  log("info", "checking if files changed upon remove", { modIds });

  const modPaths = game.getModPaths(discovery.path);
  const modTypes = Object.keys(modPaths).filter((key) => !!modPaths[key]);
  const lastDeployment: IDeployment = {};
  const snapshotPath = path.join(
    util.getVortexPath("userData" as any),
    game.id,
    "snapshots",
    "snapshot.json",
  );

  let oldSnap;
  try {
    oldSnap = JSON.parse(
      await fs.readFileAsync(snapshotPath, { encoding: "utf-8" }),
    );
  } catch (err) {
    if (err.code !== "ENOENT") {
      log("error", "Failed to check for added files", err.message);
    }
    return;
  }
  return Promise.all(
    modTypes.map((modType) =>
      util
        .getManifest(api, modType, gameId)
        .then((manifest) => (lastDeployment[modType] = manifest.files)),
    ),
  )
    .then(async () => {
      const profileId = selectors.lastActiveProfileForGame(state, gameId);
      return checkForFileChanges(api, profileId, lastDeployment);
    })
    .catch((err) => {
      log("error", "Failed to check for added files", err.message);
      return;
    });
}

function makeOnWillRemoveMods(api: types.IExtensionApi) {
  const debouncer = new util.Debouncer(
    (gameId: string, modIds: string[]) => {
      return Bluebird.resolve(doPreRemoveModCheck(api, gameId, modIds));
    },
    2000,
    true,
    true,
  );
  return async (gameId: string, modIds: string[]) =>
    new Promise<void>((resolve, reject) => {
      debouncer.schedule(() => resolve(), gameId, modIds);
    });
}

function makeOnWillDeploy(api: types.IExtensionApi) {
  return async (profileId: string, deployment: IDeployment) =>
    checkForFileChanges(api, profileId, deployment);
}

function makeOnWillPurge(api: types.IExtensionApi) {
  return async (profileId: string, deployment: IDeployment) =>
    checkForFileChanges(api, profileId, deployment);
}

function makeOnDidDeploy(api: types.IExtensionApi) {
  const t = api.translate;

  return async (
    profileId: string,
    deployment: IDeployment,
    setTitle: (title: string) => void,
  ) => {
    setTitle(t("Creating snapshots", { ns: NAMESPACE }));

    const profile = selectors.profileById(api.store.getState(), profileId);
    if (profile === undefined) {
      log("error", "will-purge event with invalid profile id", { profileId });
      return;
    }
    const snapshotPath = path.join(
      util.getVortexPath("userData" as any),
      profile.gameId,
      "snapshots",
      "snapshot.json",
    );

    try {
      const roots = await createSnapshot(api, profileId, deployment);
      if (roots !== undefined) {
        await saveSnapshot(snapshotPath, roots);
      }
    } catch (err) {
      log("error", "failed to create/update snapshot", err.message);
      // don't leave an outdated snapshot, otherwise we may report files that
      // were part of mods
      try {
        await fs.removeAsync(snapshotPath);
      } catch (err) {
        if (!(err instanceof util.UserCanceled)) {
          log("error", "failed to delete outdated snapshot", err.message);
        }
      }
    }
  };
}

function makeOnDidPurge(api: types.IExtensionApi) {
  return async (profileId: string) => {
    const profile = selectors.profileById(api.store.getState(), profileId);
    if (profile === undefined) {
      log("error", "did-purge event with invalid profile id", { profileId });
      return;
    }
    const snapshotPath = path.join(
      util.getVortexPath("userData" as any),
      profile.gameId,
      "snapshots",
      "snapshot.json",
    );

    try {
      const roots = await createSnapshot(api, profileId, undefined);
      if (roots !== undefined) {
        await saveSnapshot(snapshotPath, roots);
      }
    } catch (err) {
      log("error", "failed to create/update snapshot", err.message);
      // don't leave an outdated snapshot, otherwise we may report files that
      // were part of mods
      await fs.removeAsync(snapshotPath);
    }
  };
}

function init(context: types.IExtensionContext): boolean {
  context.once(() => {
    context.api.onAsync("will-deploy", makeOnWillDeploy(context.api));
    context.api.onAsync("did-deploy", makeOnDidDeploy(context.api));
    context.api.onAsync("will-purge", makeOnWillPurge(context.api));
    context.api.onAsync("did-purge", makeOnDidPurge(context.api));
    context.api.onAsync("will-remove-mods", makeOnWillRemoveMods(context.api));
  });

  return true;
}

export default init;
