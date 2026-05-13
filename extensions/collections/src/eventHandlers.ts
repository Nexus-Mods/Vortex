import * as path from "path";

import { ICollection, IDownloadURL, IRevision } from "@nexusmods/nexus-api";
import Bluebird from "bluebird";
import { actions, fs, selectors, types, util } from "vortex-api";

import { readCollection } from "./util/importCollection";
import InstallDriver from "./util/InstallDriver";
import { collectionModToRule } from "./util/transformCollection";
import showChangelog from "./views/InstallDialog/InstallChangelogDialog";

async function collectionUpdate(
  api: types.IExtensionApi,
  downloadGameId: string,
  collectionSlug: string,
  revisionNumber: string,
  oldModId: string,
) {
  try {
    const latest: IRevision = (
      await api.emitAndAwait(
        "get-nexus-collection-revision",
        collectionSlug,
        parseInt(revisionNumber, 10),
      )
    )[0];
    if (latest === undefined) {
      throw new util.ProcessCanceled(
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
    const downloadURLs: IDownloadURL[] = (
      await api.emitAndAwait("resolve-collection-url", latest.downloadLink)
    )[0];
    let dlId: string;
    try {
      const fileName = util.sanitizeFilename(collection.name);
      dlId = await util.toPromise((cb) =>
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
      if (err.name === "AlreadyDownloaded") {
        const { files } = api.getState().persistent.downloads;
        dlId = Object.keys(files).find((iter) => files[iter].localPath === err.fileName);
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
    const tempDir = path.join(util.getVortexPath("temp"), "collection-update-" + oldModId);

    let newRules: types.IModRule[];
    const szip = new util.SevenZip();
    await szip.extractFull(archivePath, tempDir);
    try {
      const newCollectionData = await readCollection(api, path.join(tempDir, "collection.json"));
      const knownGames = selectors.knownGames(api.getState());
      newRules = newCollectionData.mods.map((mod) => collectionModToRule(knownGames, mod));
    } catch (err) {
      await fs.removeAsync(tempDir).catch(() => undefined);
      throw err;
    }

    const oldRules = oldMod?.rules ?? [];
    const mods = api.getState().persistent.mods[gameMode];

    // candidates is any mod that is depended upon by the old revision that was installed
    // as a dependency
    const candidates = oldRules
      .filter((rule) => ["requires", "recommends"].includes(rule.type))
      .map((rule) => util.findModByRef(rule.reference, mods))
      .filter((mod) => mod !== undefined && mod.attributes?.["installedAsDependency"] === true);

    const notCandidates = Object.values(mods).filter(
      (mod) => !candidates.includes(mod) && mod.id !== oldModId,
    );

    const references = (rules: types.IModRule[], mod: types.IMod) =>
      (rules ?? []).find(
        (rule) =>
          ["requires", "recommends"].includes(rule.type) &&
          util.testModReference(mod, rule.reference),
      ) !== undefined;

    // for each dependency of the collection,
    const obsolete = candidates
      // see if there is a mod outside candidates that requires it but before anything we
      // check the new version of the collection because that's the most likely to require it
      .filter((mod) => !references(newRules, mod))
      .filter(
        (mod) =>
          notCandidates
            // that depends upon the candidate,
            .find((other) => references(other.rules, mod)) === undefined,
      );

    await fs.removeAsync(tempDir).catch(() => undefined);

    let ops = { remove: [], keep: [] };

    if (obsolete.length > 0) {
      const collectionName = collection?.name ?? util.renderModName(oldMod);
      const result: types.IDialogResult = await api.showDialog(
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
        const reviewResult: types.IDialogResult = await api.showDialog(
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
              text: util.renderModName(mod),
              value: true,
            })),
          },
          [{ label: "Keep All" }, { label: "Remove selected" }],
        );
        if (reviewResult.action === "Keep All") {
          ops.keep = obsolete.map((mod) => mod.id);
        } else {
          ops = Object.keys(reviewResult.input).reduce(
            (prev, value) => {
              if (reviewResult.input[value]) {
                prev.remove.push(value);
              } else {
                prev.keep.push(value);
              }
              return prev;
            },
            { remove: [], keep: [] },
          );
        }
      }
    }

    // mark kept mods as manually installed, otherwise this will be queried again
    util.batchDispatch(
      api.store,
      ops.keep.map((modId) =>
        actions.setModAttribute(gameMode, modId, "installedAsDependency", false),
      ),
    );

    // Snapshot which optional mods are enabled before removing the old collection
    const profile = selectors.activeProfile(api.getState());
    const enabledOptionalMods: string[] = candidates
      .filter((mod) => {
        const isOptional = oldRules.some(
          (r) => r.type === "recommends" && util.testModReference(mod, r.reference),
        );
        return isOptional && util.getSafe(profile?.modState, [mod.id, "enabled"], false);
      })
      .map((mod) => mod.id);

    // Remove old collection and obsolete mods
    await util.toPromise((cb) =>
      api.events.emit("remove-mods", gameMode, [oldModId, ...ops.remove], cb, {
        incomplete: true,
        ignoreInstalling: true,
      }),
    );

    // Install the new revision — did-install-mod will start the driver
    // cleanly since cleanup is already done
    const newModId = await util.toPromise<string | undefined>((cb) =>
      api.events.emit("start-install-download", dlId, undefined, cb),
    );

    if (newModId === undefined) {
      throw new util.ProcessCanceled("Download failed, update archive not found");
    }

    // Restore enabled state for optional mods that survived the update
    if (profile !== undefined && enabledOptionalMods.length > 0) {
      const currentMods = api.getState().persistent.mods[gameMode];
      util.batchDispatch(
        api.store,
        enabledOptionalMods
          .filter((id) => currentMods?.[id] !== undefined)
          .map((id) => actions.setModEnabled(profile.id, id, true)),
      );
    }
  } catch (err) {
    if (!(err instanceof util.UserCanceled)) {
      api.showErrorNotification("Failed to download collection", err, {
        allowReport: !(err instanceof util.ProcessCanceled),
        warning: err instanceof util.ProcessCanceled,
      } as any);
    }
  }
}

export function onCollectionUpdate(
  api: types.IExtensionApi,
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
          if (!(err instanceof util.UserCanceled)) {
            api.showErrorNotification("Failed to update collection", err);
          }
          cb?.(err);
        }),
    );
  };
}
