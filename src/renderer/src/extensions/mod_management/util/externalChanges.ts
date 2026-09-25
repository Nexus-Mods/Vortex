import * as path from "path";

import { getErrorCode, unknownToError } from "@vortex/shared";

import { log } from "../../../logging";
import type {
  IDeployedFile,
  IDeploymentMethod,
  IExtensionApi,
  IFileChange,
} from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { ProcessCanceled } from "../../../util/CustomErrors";
import * as fs from "../../../util/fs";
import {
  activeGameId,
  activeProfile,
  getCollectionActiveSession,
  profileById,
} from "../../../util/selectors";
import { setdefault, truthy } from "../../../util/util";
import { showExternalChanges } from "../actions/session";
import { MERGED_PATH } from "../modMerging";
import type { FileAction, IFileEntry } from "../types/IFileEntry";

/**
 * Where a manifest entry is deployed, the same way the deployment method
 * resolves it: games whose mergeMods returns a subfolder deploy each mod into
 * its own `target` below the mod path.
 */
function deployedPath(
  outputPath: string,
  entry: Pick<IDeployedFile, "target" | "relPath">,
): string {
  return truthy(entry.target)
    ? path.join(outputPath, entry.target, entry.relPath)
    : path.join(outputPath, entry.relPath);
}

function manifestKey(source: string, relPath: string): string {
  return JSON.stringify([source, relPath]);
}

/**
 * look at the file actions and act accordingly. Depending on the action this can
 * be a direct file operation or a modification to the previous manifest so that
 * the deployment ext runs the necessary operation
 * @param {string} sourcePath the "virtual" mod directory
 * @param {string} outputPath the destination directory where the game expects mods
 * @param {IDeployedFile[]} lastDeployment previous deployment to use as reference
 * @param {IFileEntry[]} fileActions actions the user selected for external changes
 * @returns {Promise<IDeployedFile[]>} an updated deployment manifest to use as a reference
 *                                     for the new one
 */
async function applyFileActions(
  api: IExtensionApi,
  profileId: string,
  sourcePath: string,
  outputPath: string,
  lastDeployment: IDeployedFile[],
  fileActions: IFileEntry[],
): Promise<IDeployedFile[]> {
  if (fileActions === undefined || fileActions.length === 0) {
    return lastDeployment;
  }

  const actionGroups: { [type: string]: IFileEntry[] } = fileActions.reduce(
    (prev: { [type: string]: IFileEntry[] }, value) => {
      const action =
        value.action === "newest"
          ? value.sourceModified > value.destModified
            ? "drop"
            : "import"
          : value.action;

      setdefault(prev, action, []).push(value);
      return prev;
    },
    {},
  );

  // not doing anything with 'nop'. The regular deployment code is responsible for doing the right
  // thing in this case.

  const targets = new Map(
    lastDeployment.map((entry) => [manifestKey(entry.source, entry.relPath), entry.target]),
  );
  const destination = (entry: IFileEntry) =>
    deployedPath(outputPath, {
      target: targets.get(manifestKey(entry.source, entry.filePath)),
      relPath: entry.filePath,
    });

  // process the actions that the user selected in the dialog
  await Promise.all(
    (actionGroups["drop"] || []).map((entry) =>
      truthy(entry.filePath)
        ? fs.removeAsync(destination(entry))
        : Promise.reject(new Error("invalid file path")),
    ),
  );

  await Promise.all(
    (actionGroups["delete"] || []).map((entry) =>
      truthy(entry.filePath)
        ? fs.removeAsync(path.join(sourcePath, entry.source, entry.filePath))
        : Promise.reject(new Error("invalid file path")),
    ),
  );

  await Promise.all(
    (actionGroups["import"] || []).map((entry) => {
      const source = path.join(sourcePath, entry.source, entry.filePath);
      const deployed = destination(entry);
      // Very rarely we have a case where the files are links of each other
      // (or at least node reports that) so the copy would fail.
      // Instead of handling the errors (when we can't be sure if it's due to a bug in node.js
      // or the files are actually identical), delete the target first, that way the move
      // can't fail
      return fs
        .removeAsync(source)
        .then(() => fs.moveAsync(deployed, source, { overwrite: true }))
        .catch((err: unknown) => {
          if (getErrorCode(err) === "ENOENT") {
            log("warn", "file disappeared", unknownToError(err).message);
          } else {
            throw err;
          }
        });
    }),
  );

  // remove files that the user wants to restore from
  // the activation list because then they get reinstalled.
  // this includes files that were deleted and those replaced
  const dropSet = new Set(
    [].concat(
      (actionGroups["restore"] || []).map((entry) => entry.filePath),
      (actionGroups["drop"] || []).map((entry) => entry.filePath),
      // also remove the files that got deleted, except these won't be reinstalled
      (actionGroups["delete"] || []).map((entry) => entry.filePath),
      // also remove the files that got imported because they too only exist in staging
      // at this point
      (actionGroups["import"] || []).map((entry) => entry.filePath),
    ),
  );
  const newDeployment = lastDeployment.filter((entry) => !dropSet.has(entry.relPath));
  lastDeployment = newDeployment;

  const affectedMods = new Set<string>();
  const testFileOverrides: { [modId: string]: string[] } = {};
  fileActions.forEach((action) => {
    if (["import", "newest", "nop", "delete", "drop"].indexOf(action.action) !== -1) {
      affectedMods.add(action.source);
    }

    if (action.type === "srcdeleted" && action.action === "drop") {
      // A file has been deleted from the staging folder - we need to check whether
      //  the user had set a file override for it.
      const current = testFileOverrides[action.source] || [];
      testFileOverrides[action.source] = current.concat(action.filePath);
    }
  });

  const state = api.store.getState();
  let gameId: string;

  if (profileId !== undefined) {
    const profile = profileById(state, profileId);
    if (profile !== undefined) {
      gameId = profile.id;
    }
  }

  if (gameId === undefined) {
    gameId = activeGameId(state);
  }

  if (Object.keys(testFileOverrides).length > 0) {
    api.events.emit("check-file-override-redundancies", gameId, testFileOverrides);
  }

  affectedMods.forEach((affected) => {
    api.events.emit("mod-content-changed", gameId, affected);
  });

  return lastDeployment;
}

function defaultAction(changeType: string): FileAction {
  switch (changeType) {
    case "refchange":
      return "newest";
    case "valchange":
      return "nop";
    case "deleted":
      return "delete";
    case "srcdeleted":
      return "drop";
    default:
      throw new Error("invalid file change " + changeType);
  }
}

export type ExternalChangeBucket = "merged" | "autoResolved" | "rest";

/**
 * Decide which bucket an external file change belongs to. Pure function so the
 * decision is testable in isolation (see externalChanges.test.ts).
 *
 *   - merged:       file originates from the __merged folder; always resolved
 *                   silently via defaultInternalAction.
 *   - autoResolved: change is expected because Vortex just touched the source
 *                   mod (collection install, or installationPath in
 *                   recentChanges); resolved silently.
 *   - rest:         surfaced to the user via the external-changes dialog.
 */
export function classifyExternalChange(
  change: IFileChange,
  context: {
    isInstallingCollection: boolean;
    recentChanges?: Set<string>;
    installedSources?: Set<string>;
    verifiedOrphans?: Set<IFileChange>;
  },
): ExternalChangeBucket {
  if (path.basename(change.source).startsWith(MERGED_PATH)) {
    return "merged";
  }
  if (context.isInstallingCollection || context.recentChanges?.has(change.source)) {
    return "autoResolved";
  }
  // If Vortex has removed the owning mod from its state, a missing staging
  // source is the expected result of uninstalling it. Dropping the entry
  // deletes the deployed file, so only do that silently when the file was
  // verified as still being the one Vortex deployed (see verifyOrphans).
  // Anything else, such as a file the user put there after uninstalling, is
  // left for the user to decide.
  if (isOrphanCandidate(change, context.installedSources) && context.verifiedOrphans?.has(change)) {
    return "autoResolved";
  }
  return "rest";
}

function isOrphanCandidate(change: IFileChange, installedSources?: Set<string>): boolean {
  return (
    change.changeType === "srcdeleted" &&
    installedSources !== undefined &&
    !installedSources.has(change.source)
  );
}

/**
 * Find the orphan candidates whose deployed file is still the one Vortex
 * deployed. srcdeleted is raised whenever anything exists at the destination,
 * so it says nothing about who put the file there. A hardlink shares the
 * staging file's modification time, which the manifest recorded at deployment;
 * a file that was replaced or edited since has a different one. The recorded
 * time is the staging file's mtime, which extraction sets to the file's
 * timestamp inside the mod archive, so it is not unique to this deployment:
 * any file carrying the archive's original timestamp for that file, such as a
 * manual re-extraction of the same archive or a timestamp-preserving copy,
 * also matches and is deleted without a prompt. A missing
 * manifest entry, a destination that is not a regular file or cannot be read
 * all count as unverified.
 */
async function verifyOrphans(
  changes: { [typeId: string]: IFileChange[] },
  modPaths: { [typeId: string]: string },
  lastDeployment: { [typeId: string]: IDeployedFile[] },
  installedSources?: Set<string>,
): Promise<Set<IFileChange>> {
  const verified = new Set<IFileChange>();
  for (const typeId of Object.keys(changes)) {
    const candidates = changes[typeId].filter((change) =>
      isOrphanCandidate(change, installedSources),
    );
    if (candidates.length === 0 || modPaths[typeId] === undefined) {
      continue;
    }
    const manifest = new Map(
      (lastDeployment[typeId] ?? []).map((entry) => [
        manifestKey(entry.source, entry.relPath),
        entry,
      ]),
    );
    await Promise.all(
      candidates.map(async (change) => {
        const entry = manifest.get(manifestKey(change.source, change.filePath));
        if (entry?.time === undefined) {
          return;
        }
        try {
          const stats = await fs.lstatAsync(deployedPath(modPaths[typeId], entry));
          // The manifest time comes from a directory walk that may only have
          // whole-second precision, so compare at that granularity.
          if (
            stats.isFile() &&
            Math.floor(stats.mtime.getTime() / 1000) === Math.floor(entry.time / 1000)
          ) {
            verified.add(change);
          }
        } catch (err) {
          log("debug", "can't verify deployed file of uninstalled mod", {
            filePath: change.filePath,
            error: unknownToError(err).message,
          });
        }
      }),
    );
  }
  return verified;
}

export function changeToEntry(modTypeId: string, change: IFileChange): IFileEntry {
  return {
    modTypeId,
    filePath: change.filePath,
    source: change.source,
    type: change.changeType,
    action: defaultAction(change.changeType),
    sourceModified: change.sourceTime,
    destModified: change.destTime,
  };
}

function defaultInternalAction(typeId: string, input: IFileChange): IFileEntry {
  // Internal changes are from mod updates/reinstalls/merges; always drop the old
  // deployed file so deployment recreates it from the updated staging files.
  const action: FileAction = {
    refchange: "drop",
    valchange: "nop",
    deleted: "restore",
    srcdeleted: "drop",
  }[input.changeType] as FileAction;

  return {
    ...changeToEntry(typeId, input),
    action,
  };
}

async function checkForExternalChanges(
  api: IExtensionApi,
  activator: IDeploymentMethod,
  profileId: string,
  stagingPath: string,
  modPaths: { [typeId: string]: string },
  lastDeployment: { [typeId: string]: IDeployedFile[] },
): Promise<{ [typeId: string]: IFileChange[] }> {
  // for each mod type, check if the local files were changed outside vortex
  const changes: { [typeId: string]: IFileChange[] } = {};
  log("debug", "determine external changes");
  // update mod state again because if the user did have to confirm,
  // it's more intuitive if we deploy the state at the time he confirmed, not when
  // the deployment was triggered
  const state = api.store.getState() as IState;

  const profile = profileById(state, profileId) ?? activeProfile(state);
  if (profile === undefined) {
    throw new ProcessCanceled("Profile no longer exists.");
  }
  for (const typeId of Object.keys(modPaths)) {
    log("debug", "checking external changes", {
      modType: typeId,
      count: lastDeployment[typeId]?.length ?? 0,
    });
    const fileChanges = await activator.externalChanges(
      profile.gameId,
      stagingPath,
      modPaths[typeId],
      lastDeployment[typeId],
    );
    if (fileChanges.length > 0) {
      changes[typeId] = fileChanges;
    }
  }
  return changes;
}

export function dealWithExternalChanges(
  api: IExtensionApi,
  activator: IDeploymentMethod,
  profileId: string,
  stagingPath: string,
  modPaths: { [typeId: string]: string },
  lastDeployment: { [typeId: string]: IDeployedFile[] },
  // Installation paths whose mods Vortex itself just installed or removed.
  // change.source is set from mod.installationPath (see LinkingDeployment),
  // so we match against installation paths, not mod IDs; these can differ in
  // the update-via-replace flow.
  recentChanges?: Set<string>,
) {
  return checkForExternalChanges(api, activator, profileId, stagingPath, modPaths, lastDeployment)
    .then(async (changes: { [typeId: string]: IFileChange[] }) => {
      const automaticActions: IFileEntry[] = [];
      const userChanges: { [typeId: string]: IFileChange[] } = {};
      let count = 0;
      const state = api.store.getState() as IState;
      const isInstallingCollection = getCollectionActiveSession(state) !== undefined;
      // Resolve the game the same way checkForExternalChanges does. profileId can
      // be stale (that is why the activeProfile fallback exists there), and
      // reading persistent.profiles[profileId] directly would yield undefined for
      // a stale id, which would make every source look uninstalled.
      //
      // The unknown case is specifically "we could not work out which game this
      // is": only then is undefined right, so classifyExternalChange skips the
      // check. Once the game IS known, a missing or empty mod table means
      // exactly what it says — nothing is installed — so an empty Set is
      // correct. Treating that as unknown would miss the common case of
      // removing the last remaining mod, where the game's mod table goes away.
      const profile = profileById(state, profileId) ?? activeProfile(state);
      const installedSources =
        profile === undefined
          ? undefined
          : new Set(
              Object.values(state.persistent.mods?.[profile.gameId] ?? {})
                .map((mod) => mod?.installationPath)
                .filter(truthy),
            );
      const verifiedOrphans = await verifyOrphans(
        changes,
        modPaths,
        lastDeployment,
        installedSources,
      );
      const context = {
        isInstallingCollection,
        recentChanges,
        installedSources,
        verifiedOrphans,
      };

      for (const typeId of Object.keys(changes)) {
        for (const change of changes[typeId]) {
          if (classifyExternalChange(change, context) === "rest") {
            (userChanges[typeId] ??= []).push(change);
            count++;
          } else {
            automaticActions.push(defaultInternalAction(typeId, change));
          }
        }
      }

      if (count > 0) {
        log("info", "found external changes", {
          automated: automaticActions.length,
          user: count,
        });
        // Diagnostic: dump the surfaced changes plus the recentChanges set
        // so update-via-replace false positives can be diagnosed from logs.
        log("debug", "external changes diagnostic", {
          isInstallingCollection,
          recentChanges: Array.from(recentChanges ?? []),
          surfaced: Object.entries(userChanges).flatMap(([typeId, list]) =>
            list.map((change) => ({
              typeId,
              filePath: change.filePath,
              source: change.source,
              changeType: change.changeType,
            })),
          ),
        });
        return api.store
          .dispatch(showExternalChanges(userChanges))
          .then((userActions) => [].concat(automaticActions, userActions));
      } else {
        return automaticActions;
      }
    })
    .then(async (fileActions: IFileEntry[]) => {
      const results: IDeployedFile[][] = [];
      for (const typeId of Object.keys(lastDeployment)) {
        const newLastDeployment = await applyFileActions(
          api,
          profileId,
          stagingPath,
          modPaths[typeId],
          lastDeployment[typeId],
          fileActions.filter((action) => action.modTypeId === typeId),
        );
        lastDeployment[typeId] = newLastDeployment;
        results.push(newLastDeployment);
      }
      return results;
    });
}
