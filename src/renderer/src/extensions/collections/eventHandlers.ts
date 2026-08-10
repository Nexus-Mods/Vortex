import * as path from "path";

import type { ICollection, IDownloadURL, IRevision } from "@nexusmods/nexus-api";
import { unknownToError } from "@vortex/shared";
import Bluebird from "bluebird";
import SevenZip from "node-7z";

import * as actions from "../../actions";
import { emitModStateChanged } from "../../extensions/analytics/mixpanel/modChangeAnalytics";
import type { IModRule } from "../../extensions/mod_management/types/IMod";
import renderModName from "../../extensions/mod_management/util/modName";
import type { IDialogResult } from "../../types/IDialog";
import type { IExtensionApi } from "../../types/IExtensionContext";
import { ProcessCanceled, UserCanceled } from "../../util/CustomErrors";
import * as fs from "../../util/fs";
import getVortexPath from "../../util/getVortexPath";
import * as selectors from "../../util/selectors";
import { batchDispatch, sanitizeFilename, toPromise } from "../../util/util";
import {
  findEnabledOptionalMembers,
  findInstalledDependencyMembers,
  findObsoleteMembers,
  partitionReviewSelection,
  type IReviewSelection,
} from "./util/collectionUpdate";
import { REFERENCE_TAG_SCHEME } from "./util/deterministicReferenceTag";
import type InstallDriver from "./util/InstallDriver";
import { readCollection } from "./util/readCollection";
import { collectionModToRule } from "./util/transformCollection";
import showChangelog from "./views/InstallDialog/InstallChangelogDialog";

async function collectionUpdate(
  api: IExtensionApi,
  downloadGameId: string,
  collectionSlug: string,
  revisionNumber: string,
  oldModId: string,
) {
  try {
    const latest = (
      await api.emitAndAwait<"get-nexus-collection-revision">(
        "get-nexus-collection-revision",
        collectionSlug,
        parseInt(revisionNumber, 10),
      )
    )[0];
    if (latest === undefined) {
      throw new ProcessCanceled(
        `Server returned no info on collection ${collectionSlug}, revision ${revisionNumber}`,
      );
    }
    const collection: ICollection = latest.collection;
    if (collectionSlug !== collection.slug) {
      throw new Error(`Invalid collection "${collectionSlug}"`);
    }

    const state = api.getState();
    const gameMode = selectors.activeGameId(state);

    const oldMod = state.persistent.mods[gameMode][oldModId];
    // oldMod might be undefined if the user manually removed the collection in the time
    // it took us to download the new revision

    if (!!latest.collectionChangelog?.description && oldMod !== undefined) {
      await showChangelog(oldMod, gameMode, latest);
    }

    const modInfo = {
      game: downloadGameId,
      source: "nexus",
      name: collection?.name,
      nexus: {
        ids: {
          gameId: downloadGameId,
          collectionId: collection.id,
          collectionSlug,
          revisionId: latest.id,
          revisionNumber: latest.revisionNumber,
        },
        revisionInfo: latest,
      },
    };
    const downloadURLs = (
      await api.emitAndAwait<"resolve-collection-url">(
        "resolve-collection-url",
        latest.downloadLink,
      )
    )[0];
    let dlId: string;
    try {
      const fileName = sanitizeFilename(collection.name);
      dlId = await toPromise((cb) =>
        api.events.emit(
          "start-download",
          downloadURLs.map((iter) => iter.URI),
          modInfo,
          fileName + `-rev${latest.revisionNumber}.7z`,
          cb,
          "never",
          { allowInstall: false },
        ),
      );
    } catch (err) {
      const e = err as Error & { fileName?: string };
      if (e.name === "AlreadyDownloaded") {
        const { files } = api.getState().persistent.downloads;
        dlId = Object.keys(files).find((iter) => files[iter].localPath === e.fileName);
      }
      if (dlId === undefined) {
        throw err;
      }
    }

    api.events.emit("analytics-track-click-event", "Collections", "Update Collection");

    // Determine obsolete mods and clean up BEFORE installing the new revision.
    // This prevents a race condition where did-install-mod starts the InstallDriver
    // concurrently with the cleanup below.

    // Extract collection.json from the downloaded archive to get the new revision's
    // full mod list (including tags, external and bundled mods).
    const dlPath = selectors.downloadPathForGame(api.getState(), downloadGameId);
    const localPath = api.getState().persistent.downloads.files[dlId]?.localPath;
    const archivePath = path.join(dlPath, localPath);
    const tempDir = path.join(getVortexPath("temp"), "collection-update-" + oldModId);

    let newRules: IModRule[];
    const szip = new SevenZip();
    await szip.extractFull(archivePath, tempDir);
    try {
      const newCollectionData = await readCollection(api, path.join(tempDir, "collection.json"));
      const knownGames = selectors.knownGames(api.getState());
      const deterministic =
        newCollectionData.collectionConfig?.referenceTagScheme === REFERENCE_TAG_SCHEME;
      newRules = newCollectionData.mods.map((mod) =>
        collectionModToRule(knownGames, mod, deterministic),
      );
    } catch (err) {
      await fs.removeAsync(tempDir).catch(() => undefined);
      throw err;
    }

    const oldRules = oldMod?.rules ?? [];
    const mods = api.getState().persistent.mods[gameMode];

    // the old revision's installed dependency members, reused below for both the obsolete-removal
    // decision and the enabled-optional snapshot
    const candidates = findInstalledDependencyMembers(oldRules, mods);
    const obsolete = findObsoleteMembers(candidates, newRules, mods, oldModId);

    await fs.removeAsync(tempDir).catch(() => undefined);

    let ops: IReviewSelection = { remove: [], keep: [] };

    if (obsolete.length > 0) {
      const collectionName = collection?.name ?? renderModName(oldMod);
      const result: IDialogResult = await api.showDialog(
        "question",
        "Remove mods from old revision?",
        {
          text:
            "There are {{count}} mods installed that are not present in the latest " +
            'revision of "{{collectionName}}". It is recommended that you remove the ' +
            "unused mods to avoid compatibility issues going forward. " +
            "If you choose to keep the mods installed they will no longer be associated " +
            "with this Collection and will be managed as if they have been installed " +
            "individually. Would you like to remove the old mods now?",
          parameters: {
            count: obsolete.length,
            collectionName,
          },
        },
        [{ label: "Keep All" }, { label: "Review Mods" }, { label: "Remove All" }],
      );

      if (result.action === "Keep All") {
        ops.keep = obsolete.map((mod) => mod.id);
      } else if (result.action === "Remove All") {
        ops.remove = obsolete.map((mod) => mod.id);
      } else {
        // Review
        const reviewResult: IDialogResult = await api.showDialog(
          "question",
          "Remove mods from old revision?",
          {
            text:
              "The following mods are not present in the latest revision of " +
              '"{{collectionName}}". Please select the ones to remove.',
            parameters: {
              collectionName,
            },
            checkboxes: obsolete.map((mod) => ({
              id: mod.id,
              text: renderModName(mod),
              value: true,
            })),
          },
          [{ label: "Keep All" }, { label: "Remove selected" }],
        );
        if (reviewResult.action === "Keep All") {
          ops.keep = obsolete.map((mod) => mod.id);
        } else {
          ops = partitionReviewSelection(reviewResult.input);
        }
      }
    }

    // mark kept mods as manually installed, otherwise this will be queried again
    batchDispatch(
      api.store,
      ops.keep.map((modId) =>
        actions.setModAttribute(gameMode, modId, "installedAsDependency", false),
      ),
    );

    // Snapshot which optional mods are enabled before removing the old collection
    const profile = selectors.activeProfile(api.getState());
    const enabledOptionalMods = findEnabledOptionalMembers(candidates, oldRules, profile?.modState);

    // Remove old collection and obsolete mods
    await toPromise((cb) =>
      api.events.emit("remove-mods", gameMode, [oldModId, ...ops.remove], cb, {
        incomplete: true,
        ignoreInstalling: true,
        reason: "collection_update",
      }),
    );

    // Install the new revision — did-install-mod will start the driver
    // cleanly since cleanup is already done
    const newModId = await toPromise<string | undefined>((cb) =>
      api.events.emit("start-install-download", dlId, undefined, cb),
    );

    if (newModId === undefined) {
      throw new ProcessCanceled("Download failed, update archive not found");
    }

    // Restore enabled state for optional mods that survived the update
    if (profile !== undefined && enabledOptionalMods.length > 0) {
      const currentMods = api.getState().persistent.mods[gameMode];
      const restoreIds = enabledOptionalMods.filter((id) => currentMods?.[id] !== undefined);
      batchDispatch(
        api.store,
        restoreIds.map((id) => actions.setModEnabled(profile.id, id, true)),
      );
      // this re-enable bypasses the mods-enabled event, so emit the state change directly.
      restoreIds.forEach((id) =>
        emitModStateChanged(api, gameMode, id, "enabled", "collection_update"),
      );
    }
  } catch (err) {
    if (!(err instanceof UserCanceled)) {
      api.showErrorNotification("Failed to download collection", unknownToError(err), {
        allowReport: !(err instanceof ProcessCanceled),
        warning: err instanceof ProcessCanceled,
      });
    }
  }
}

export function onCollectionUpdate(
  api: IExtensionApi,
  driver: InstallDriver,
): (...args: any[]) => void {
  return (
    gameId: string,
    collectionSlug: string,
    revisionNumber: number | string,
    source: string,
    oldModId: string,
    cb: (err: Error) => void,
  ) => {
    if (source !== "nexus" || collectionSlug === undefined || revisionNumber === undefined) {
      return;
    }

    driver.prepare(() =>
      Bluebird.resolve(
        collectionUpdate(api, gameId, collectionSlug, revisionNumber.toString(), oldModId),
      )
        .then(() => {
          cb?.(null);
        })
        .catch((err) => {
          if (!(err instanceof UserCanceled)) {
            api.showErrorNotification("Failed to update collection", unknownToError(err));
          }
          cb?.(err);
        }),
    );
  };
}
