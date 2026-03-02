import { setDownloadModInfo } from "../../actions";
import type {
  IExtensionApi,
  StateChangeCallback,
} from "../../types/IExtensionContext";
import type { IDownload, IMod, IModTable, IState } from "../../types/IState";
import {
  DataInvalid,
  ProcessCanceled,
  UserCanceled,
} from "../../util/CustomErrors";
import Debouncer from "../../util/Debouncer";
import * as fs from "../../util/fs";
import { log } from "../../util/log";
import { calcDuration, showError } from "../../util/message";
import { upload } from "../../util/network";
import opn from "../../util/opn";
import {
  activeGameId,
  currentGame,
  downloadPathForGame,
  gameById,
  knownGames,
} from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";
import { batchDispatch, truthy } from "../../util/util";

import { resolveCategoryName } from "../category_management";
import {
  AlreadyDownloaded,
  DownloadIsHTML,
} from "../download_management/DownloadManager";
import { SITE_ID } from "../gamemode_management/constants";
import type { IGameStoredExt } from "../gamemode_management/types/IGameStored";
import { setUpdatingMods } from "../mod_management/actions/session";
import type { IModListItem } from "../news_dashlet/types";

import { setUserInfo } from "./actions/persistent";
import { findLatestUpdate, retrieveModInfo } from "./util/checkModsVersion";
import {
  nexusGameId,
  toNXMId,
  convertGameIdReverse,
} from "./util/convertGameId";
import {
  FULL_COLLECTION_INFO,
  FULL_REVISION_INFO,
  CURRENT_REVISION_INFO,
  COLLECTION_SEARCH_QUERY,
  MOD_REQUIREMENTS_INFO,
  MY_COLLECTIONS_SEARCH_QUERY,
} from "./util/graphQueries";
import submitFeedback from "./util/submitFeedback";

import {
  NEXUS_BASE_URL,
  NEXUS_GAMES_URL,
  USERINFO_ENDPOINT,
} from "./constants";
import {
  checkModVersionsImpl,
  endorseDirectImpl,
  endorseThing,
  ensureLoggedIn,
  processErrorMessage,
  resolveGraphError,
  startDownload,
  transformUserInfoFromApi,
  updateKey,
  updateToken,
} from "./util";

import type {
  EndorsedStatus,
  ICollection,
  ICollectionManifest,
  ICollectionSearchOptions,
  ICollectionQuery,
  ICollectionSearchResult,
  IDownloadURL,
  IFeedbackResponse,
  IFileInfo,
  IIssue,
  IModFileContentPage,
  IModInfo,
  IModRequirements,
  IRating,
  IRevision,
  IModFileContentPageQuery,
  IModFileContentSearchFilter,
  IPreferenceQuery,
  IPreference,
} from "@nexusmods/nexus-api";
import type Nexus from "@nexusmods/nexus-api";
import { NexusError, RateLimitError, TimeoutError } from "@nexusmods/nexus-api";
import Bluebird from "bluebird";
import * as path from "path";
import * as semver from "semver";
import type { ITokenReply } from "./util/oauth";
import { isLoggedIn } from "./selectors";
import type { IValidateKeyDataV2 } from "./types/IValidateKeyData";
import {
  getErrorCode,
  getErrorMessageOrDefault,
  unknownToError,
} from "@vortex/shared";

export function onChangeDownloads(api: IExtensionApi, nexus: Nexus) {
  const state: IState = api.store.getState();
  // Cache for mod/file info to avoid duplicate API calls
  const infoCache = new Map<string, any>();
  const IDS_PATH = ["modInfo", "nexus", "ids"];
  const updateDebouncer: Debouncer = new Debouncer(
    (
      oldDownloadTable: { [id: string]: IDownload },
      newDownloadTable: { [id: string]: IDownload },
    ) => {
      if (oldDownloadTable === newDownloadTable) {
        return Bluebird.resolve();
      }

      // Only process downloads that have actually changed
      const changedDownloadIds = Object.keys(newDownloadTable).filter(
        (dlId) => {
          const newDownload = newDownloadTable[dlId];
          const oldDownload = oldDownloadTable?.[dlId];

          if (!oldDownload || !newDownload) return true;

          const newModId = getSafe(
            newDownload,
            [...IDS_PATH, "modId"],
            undefined,
          );
          const newFileId = getSafe(
            newDownload,
            [...IDS_PATH, "fileId"],
            undefined,
          );
          const oldModId = getSafe(
            oldDownload,
            [...IDS_PATH, "modId"],
            undefined,
          );
          const oldFileId = getSafe(
            oldDownload,
            [...IDS_PATH, "fileId"],
            undefined,
          );

          return newModId !== oldModId || newFileId !== oldFileId;
        },
      );

      if (changedDownloadIds.length === 0) {
        return Bluebird.resolve();
      }

      return Bluebird.map(
        changedDownloadIds,
        (dlId) => {
          const download = newDownloadTable[dlId];
          const modId = getSafe(download, [...IDS_PATH, "modId"], undefined);
          const fileId = getSafe(download, [...IDS_PATH, "fileId"], undefined);

          if (!modId) {
            return Bluebird.resolve();
          }

          const rawGame =
            Array.isArray(download.game) && download.game.length > 0
              ? download.game[0]
              : activeGameId(api.store.getState());
          // Ensure we use the internal game id for lookups and domain conversion
          const metaGameId = rawGame
            ? convertGameIdReverse(knownGames(api.store.getState()), rawGame) ||
              rawGame
            : rawGame;

          const gameDomain = nexusGameId(
            gameById(state, metaGameId),
            metaGameId,
          );

          // Create cache keys for deduplication
          const modInfoKey = `mod_${modId}_${gameDomain}`;
          const fileInfoKey =
            fileId !== undefined
              ? `file_${modId}_${fileId}_${gameDomain}`
              : null;

          // Fetch mod info with caching
          let modInfoBluebird = infoCache.get(modInfoKey);
          if (!modInfoBluebird) {
            modInfoBluebird = nexus
              .getModInfo(modId, gameDomain)
              .catch((err) => {
                log("warn", "failed to query mod info", {
                  modId,
                  gameDomain,
                  downloadId: dlId,
                  message: getErrorMessageOrDefault(err),
                });
                return null;
              });
            infoCache.set(modInfoKey, modInfoBluebird);
          }

          // Fetch file info with caching (if needed)
          let fileInfoBluebird = Bluebird.resolve(undefined);
          if (fileId !== undefined && fileInfoKey) {
            let cachedFileInfo = infoCache.get(fileInfoKey);
            if (!cachedFileInfo) {
              cachedFileInfo = nexus
                .getFileInfo(modId, fileId, gameDomain)
                .catch((err) => {
                  log("warn", "failed to query file info", {
                    modId,
                    fileId,
                    gameDomain,
                    downloadId: dlId,
                    message: getErrorMessageOrDefault(err),
                  });
                  return null;
                });
              infoCache.set(fileInfoKey, cachedFileInfo);
            }
            fileInfoBluebird = cachedFileInfo;
          }

          return Bluebird.all([modInfoBluebird, fileInfoBluebird])
            .then(([modInfo, fileInfo]) => {
              const batched = [];
              if (modInfo !== null) {
                batched.push(
                  setDownloadModInfo(dlId, "nexus.modInfo", modInfo),
                );
              }
              if (fileInfo !== null) {
                batched.push(
                  setDownloadModInfo(dlId, "nexus.fileInfo", fileInfo),
                );
              }

              batchDispatch(api.store, batched);
            })
            .catch((err) => {
              log("error", "unexpected error processing download info", {
                downloadId: dlId,
                modId,
                fileId,
                message: err.message,
              });
            });
        },
        { concurrency: 5 },
      )
        .then(() => {
          if (infoCache.size > 100) {
            const entries = Array.from(infoCache.entries());
            infoCache.clear();
            entries
              .slice(-50)
              .forEach(([key, value]) => infoCache.set(key, value));
          }
        })
        .catch((err) => {
          log("error", "failed to process download changes", {
            message: err.message,
          });
        });
    },
    200,
  );

  return (oldValue: IModTable, newValue: IModTable) =>
    updateDebouncer.schedule(undefined, oldValue, newValue);
}

/**
 * callback for when mods are changed
 *
 * @export
 * @param {IExtensionApi} api
 * @param {Nexus} nexus
 * @returns
 */
export function onChangeMods(api: IExtensionApi, nexus: Nexus) {
  // the state from before the debouncer last triggered
  let lastModTable = api.store.getState().persistent.mods;

  const updateDebouncer: Debouncer = new Debouncer((newModTable: IModTable) => {
    if (lastModTable === undefined || newModTable === undefined) {
      return;
    }
    const state = api.store.getState();
    const gameMode = activeGameId(state);
    // TODO: this triggers only for the current game but "swallows" all changes
    //   for all games, meaning that if we change the nexus id for a mod of a
    //   different game, it will never be re-fetched
    // ensure anything changed for the active game
    if (
      lastModTable[gameMode] !== newModTable[gameMode] &&
      lastModTable[gameMode] !== undefined &&
      newModTable[gameMode] !== undefined
    ) {
      // for any mod where modid or download section have been changed,
      // retrieve the new mod info
      return Bluebird.map(Object.keys(newModTable[gameMode]), (modId) => {
        const modSource = getSafe(
          newModTable,
          [gameMode, modId, "attributes", "source"],
          undefined,
        );
        if (modSource !== "nexus") {
          return Bluebird.resolve();
        }

        const idPath = [gameMode, modId, "attributes", "modId"];
        const dlGamePath = [gameMode, modId, "attributes", "downloadGame"];
        if (
          getSafe(lastModTable, idPath, undefined) !==
            getSafe(newModTable, idPath, undefined) ||
          getSafe(lastModTable, dlGamePath, undefined) !==
            getSafe(newModTable, dlGamePath, undefined)
        ) {
          return retrieveModInfo(
            nexus,
            api,
            gameMode,
            newModTable[gameMode][modId],
            api.translate,
          ).then(() => {
            lastModTable = newModTable;
          });
        } else {
          return Bluebird.resolve();
        }
      }).then(() => null);
    } else {
      lastModTable = newModTable;
      return Bluebird.resolve();
    }
  }, 2000);

  // we can't pass oldValue to the debouncer because that would only include the state
  // for the last time the debouncer is triggered, missing all other updates
  return (oldValue: IModTable, newValue: IModTable) =>
    updateDebouncer.schedule(undefined, newValue);
}

export function onOpenCollectionPage(api: IExtensionApi) {
  return (
    gameId: string,
    collectionSlug: string,
    revisionNumber: number,
    source: string,
  ) => {
    if (source !== "nexus") {
      return;
    }
    const game = gameById(api.store.getState(), gameId);
    const segments = [
      NEXUS_GAMES_URL,
      nexusGameId(game) || gameId,
      "collections",
      collectionSlug,
    ];
    if (revisionNumber !== undefined) {
      segments.push("revisions", revisionNumber.toString());
    }
    opn(segments.join("/")).catch(() => undefined);
  };
}

export function onOpenModPage(api: IExtensionApi) {
  return (gameId: string, modId: string, source: string) => {
    if (source !== "nexus") {
      return;
    }
    const game = gameById(api.store.getState(), gameId);
    opn(
      [NEXUS_BASE_URL, nexusGameId(game) || gameId, "mods", modId].join("/"),
    ).catch((err) => undefined);
  };
}

export function onChangeNXMAssociation(
  registerFunc: (def: boolean) => void,
  api: IExtensionApi,
): StateChangeCallback {
  return (oldValue: boolean, newValue: boolean) => {
    log("info", "associate", { oldValue, newValue });
    if (newValue === true) {
      registerFunc(true);
    } else {
      api.deregisterProtocol("nxm");
    }
  };
}

export function onRequestOwnIssues(nexus: Nexus) {
  return (cb: (err: Error, issues?: IIssue[]) => void) => {
    nexus
      .getOwnIssues()
      .then((issues) => {
        cb(null, issues);
      })
      .catch((err) => cb(unknownToError(err)));
  };
}

function getFileId(download: IDownload): number {
  const res = getSafe(
    download,
    ["modInfo", "nexus", "ids", "fileId"],
    undefined,
  );

  if (
    res === undefined &&
    getSafe(download, ["modInfo", "source"], undefined) === "nexus"
  ) {
    return getSafe(download, ["modInfo", "ids", "fileId"], undefined);
  } else {
    return res;
  }
}

function downloadFile(
  api: IExtensionApi,
  nexus: Nexus,
  game: IGameStoredExt,
  modId: number,
  fileId: number,
  fileName?: string,
  allowInstall?: boolean,
): Bluebird<string> {
  const state: IState = api.getState();
  const gameId = game?.id ?? SITE_ID;
  if (
    game != null &&
    gameId !== SITE_ID &&
    !getSafe(state, ["persistent", "nexus", "userInfo", "isPremium"], false)
  ) {
    // nexusmods can't let users download files directly from client, without
    // showing ads
    return Bluebird.reject(
      new ProcessCanceled("Only available to premium users"),
    );
  }
  // TODO: Need some way to identify if this request is actually for a nexus mod
  const url = `nxm://${toNXMId(game, gameId)}/mods/${modId}/files/${fileId}`;
  log("debug", "downloading from generated nxm link", { url, fileName });

  const downloads = state.persistent.downloads.files;
  // check if the file is already downloaded. If not, download before starting the install
  const existingId = Object.keys(downloads).find(
    (downloadId) =>
      (downloads[downloadId]?.game || []).includes(gameId) &&
      downloads[downloadId]?.modInfo?.nexus?.ids?.modId === modId &&
      downloads[downloadId]?.modInfo?.nexus?.ids?.fileId === fileId,
  );
  if (
    existingId !== undefined &&
    downloads[existingId]?.localPath !== undefined &&
    downloads[existingId]?.state !== "failed"
  ) {
    log("debug", "found an existing matching download", {
      id: existingId,
      data: JSON.stringify(downloads[existingId]),
    });
    const downloadPath = downloadPathForGame(state, gameId);
    return fs
      .statAsync(path.join(downloadPath, downloads[existingId].localPath))
      .then(() => Bluebird.resolve(existingId))
      .catch((err) =>
        err.code === "ENOENT"
          ? startDownload(
              api,
              nexus,
              url,
              fileName !== undefined ? "replace" : "never",
              fileName,
              allowInstall,
            )
          : Bluebird.reject(err),
      );
  } else {
    // startDownload will report network errors and only reject on usage error
    return startDownload(
      api,
      nexus,
      url,
      fileName !== undefined ? "replace" : "never",
      fileName,
      allowInstall,
    );
  }
}

export function onModsUpdate(api: IExtensionApi, nexus: Nexus) {
  return async (gameId: string, modIds: string[]) => {
    api.sendNotification({
      type: "activity",
      message: "Updating mods",
      id: "mods-update-multi",
      noDismiss: true,
      allowSuppress: false,
    });
    api.store.dispatch(setUpdatingMods(gameId, true));
    let game = gameId === SITE_ID ? null : gameById(api.getState(), gameId);
    log("debug", "on mods update", { gameId, modIds });
    if (!game) {
      log("warn", "mod update requested for unknown game id", gameId);
      // Attempt to get the current game from the state as a fallback
      game = currentGame(api.getState());
    }
    const mods: { [modId: string]: IMod } = getSafe(
      api.getState(),
      ["persistent", "mods", game?.id],
      {},
    );
    for (const modId of modIds) {
      const mod = mods[modId];
      if (
        !mod ||
        mod.attributes?.source !== "nexus" ||
        !mod.attributes?.newestFileId
      ) {
        log("warn", "unable to automatically update mod", modId);
        continue;
      }
      const newestFileId = getSafe(mod.attributes, ["newestFileId"], "unknown");
      if (newestFileId === "unknown") {
        // if the newestFileId is unknown, we can't update automatically.
        //  this can happen if the mod author did not specify the update chain
        //  correctly when uploading the mod file.
        continue;
      }
      const numericModId = mod.attributes?.modId;
      const downloadGame = mod.attributes?.downloadGame ?? gameId;
      onModUpdate(api, nexus)(
        downloadGame,
        numericModId,
        newestFileId,
        "nexus",
      );
    }

    api.dismissNotification("mods-update-multi");
    api.store.dispatch(setUpdatingMods(gameId, false));
  };
}

export function onModUpdate(api: IExtensionApi, nexus: Nexus) {
  return (gameId: string, modId: number, fileId: number, source: string) => {
    let game =
      gameId === SITE_ID ? null : gameById(api.store.getState(), gameId);

    if (!game) {
      log("warn", "mod update requested for unknown game id", gameId);

      // Attempt to get the current game from the state as a fallback - it's perfectly possible
      //  for the passed gameId to be a compatibleDownload entry for the currently managed game.
      game = currentGame(api.getState());
    }

    if (source !== "nexus") {
      // not a mod from nexus mods
      return;
    }

    const downloadGameId = truthy(game)
      ? game.id !== gameId
        ? gameId // download id is different from the game extension's id - this is a compatibleDownload entry.
        : game.id
      : gameId; // Game is not present in the state. Concurrency issue? lets just assign it to gameId.
    const downloadFunc = () =>
      truthy(game)
        ? downloadFile(
            api,
            nexus,
            { ...game, downloadGameId },
            modId,
            fileId,
            undefined,
            false,
          )
        : Bluebird.reject(new ProcessCanceled("Game not found")); // Can't download an update for a game extension that doesn't exist

    downloadFunc()
      .catch(AlreadyDownloaded, (err) => {
        const state = api.getState();
        const downloads = state.persistent.downloads.files;
        const dlId = Object.keys(downloads).find(
          (iter) => downloads[iter].localPath === err.fileName,
        );
        return dlId;
      })
      .then((downloadId) => {
        const state = api.getState();
        const downloads = state.persistent.downloads.files;

        if (!truthy(downloadId)) {
          // nop
        } else if (downloads[downloadId]?.state !== "finished") {
          api.store.dispatch(
            setDownloadModInfo(downloadId, "startedAsUpdate", true),
          );
        } else {
          api.events.emit("start-install-download", downloadId);
        }
      })
      .catch(DownloadIsHTML, (err) => undefined)
      .catch(DataInvalid, () => {
        const url = `nxm://${toNXMId(game, gameId)}/mods/${modId}/files/${fileId}`;
        api.showErrorNotification("Invalid URL", url, { allowReport: false });
      })
      .catch(ProcessCanceled, () => {
        const url = [
          NEXUS_BASE_URL,
          nexusGameId(game, gameId),
          "mods",
          modId,
        ].join("/");
        const params = `?tab=files&file_id=${fileId}&nmm=1`;
        return opn(url + params).catch(() => undefined);
      })
      .catch((err) => {
        api.showErrorNotification("Failed to start download", err);
      });
  };
}

export function onNexusDownload(
  api: IExtensionApi,
  nexus: Nexus,
): (...args: any[]) => Bluebird<any> {
  return (
    gameId: string,
    modId: number,
    fileId: number,
    fileName?: string,
    allowInstall?: boolean,
  ): Bluebird<string> => {
    const game =
      gameId === SITE_ID ? null : gameById(api.store.getState(), gameId);
    log("debug", "on nexus download", fileName);
    return ensureLoggedIn(api)
      .then(() => {
        if (gameId === SITE_ID || game) {
          return downloadFile(
            api,
            nexus,
            { ...game, downloadGameId: gameId },
            modId,
            fileId,
            fileName,
            allowInstall,
          );
        } else {
          return Bluebird.reject(new ProcessCanceled("Game not found"));
        }
      })
      .catch(UserCanceled, () => {
        return Bluebird.resolve(undefined);
      })
      .catch(ProcessCanceled, (err) => {
        api.sendNotification({
          type: "error",
          message: err.message,
        });
        return Bluebird.resolve(undefined);
      })
      .catch(AlreadyDownloaded, (err) => {
        const { files } = api.getState().persistent.downloads;
        const dlId = Object.keys(files).find(
          (iter) => files[iter].localPath === err.fileName,
        );
        return Bluebird.resolve(dlId);
      })
      .catch((err) => {
        api.showErrorNotification("Nexus download failed", err);
        return Bluebird.resolve(undefined);
      });
  };
}

export function onGetMyCollections(
  api: IExtensionApi,
  nexus: Nexus,
): (
  gameId: string,
  count?: number,
  offset?: number,
) => Promise<Partial<IRevision[]>> {
  return async (
    gameId: string,
    count?: number,
    offset?: number,
  ): Promise<Partial<IRevision[]>> => {
    const game = gameById(api.getState(), gameId);
    const nexusDomainId = nexusGameId(game);
    if (!nexusDomainId) {
      return [];
    }
    const userId = api.getState().persistent["nexus"]?.userInfo?.userId;
    if (userId === undefined) {
      return [];
    }
    try {
      const query: ICollectionQuery = MY_COLLECTIONS_SEARCH_QUERY;
      const searchResult: ICollectionSearchResult = await onSearchCollections(
        api,
        nexus,
        query,
      )({
        gameId: nexusDomainId,
        collectionStatuses: [
          "listed",
          "published",
          "under_moderation",
          "unlisted",
        ],
        count,
        offset,
        userId: userId.toString(),
      });

      // For each collection, pick only the latest revision (highest revisionNumber)
      const revisions: Partial<IRevision[]> = searchResult.nodes
        .map(
          (collection: ICollection) =>
            (collection.revisions ?? []).sort(
              (a, b) => b.revisionNumber - a.revisionNumber,
            )[0],
        )
        .filter((rev): rev is IRevision => rev != null);

      return revisions;
    } catch (err) {
      const code = getErrorCode(err);
      if (!["NOT_FOUND", "UNAUTHORIZED"].includes(code)) {
        api.showErrorNotification("Failed to get list of collections", err, {
          allowReport: !["MODEL_NOT_FOUND"].includes(code),
        });
      }
      return [];
    }
  };
}

export function onGetNexusCollection(
  api: IExtensionApi,
  nexus: Nexus,
): (slug: string) => Bluebird<ICollection> {
  return (slug: string): Bluebird<ICollection> => {
    if (slug === undefined) {
      return Bluebird.reject(
        new Error("invalid parameter, collectionId has to be a number"),
      );
    }

    return Bluebird.resolve(
      nexus.getCollectionGraph(FULL_COLLECTION_INFO, slug),
    ).catch((err) => {
      if (!["COLLECTION_DISCARDED", "NOT_FOUND"].includes(err.code)) {
        if (err.code === "COLLECTION_UNDER_MODERATION") {
          api.showErrorNotification(
            "Failed to get collection info",
            "The collection is under moderation",
            {
              allowReport: false,
            },
          );
        } else {
          const allowReport = !(err instanceof ProcessCanceled);
          api.showErrorNotification("Failed to get collection info", err, {
            id: "failed-get-collection-info",
            allowReport,
          });
        }
      }
      return Bluebird.resolve(undefined);
    });
  };
}

export function onGetNexusCollections(
  api: IExtensionApi,
  nexus: Nexus,
): (gameId: string) => Bluebird<ICollection[]> {
  return (gameId: string): Bluebird<ICollection[]> =>
    Bluebird.resolve(
      nexus.getCollectionListGraph(FULL_COLLECTION_INFO, gameId),
    ).catch((err) => {
      api.showErrorNotification("Failed to get list of collections", err);
      return Bluebird.resolve(undefined);
    });
}

/**
 * Search for collections using the GraphQL API
 *
 * @param {Nexus} nexus - The Nexus API instance
 * @param {types.ICollectionSearchOptions} options - Search options (gameId, filters, sort, etc.)
 * @return {Bluebird<types.ICollectionSearchResult>} Search results with nodes and totalCount
 */
export function onSearchCollections(
  api: IExtensionApi,
  nexus: Nexus,
  query?: ICollectionQuery,
): (options: ICollectionSearchOptions) => Bluebird<ICollectionSearchResult> {
  const searchQuery = query || COLLECTION_SEARCH_QUERY;
  return (options) => {
    return Bluebird.resolve(nexus.searchCollectionsGraph(searchQuery, options));
  };
}

export function onResolveCollectionUrl(
  api: IExtensionApi,
  nexus: Nexus,
): (apiLink: string) => Bluebird<IDownloadURL[]> {
  return (apiLink: string): Bluebird<IDownloadURL[]> =>
    Bluebird.resolve(nexus.getCollectionDownloadLink(apiLink)).catch((err) => {
      api.showErrorNotification("Failed to get list of collections", err);
      return Bluebird.resolve([]);
    });
}

export function onGetNexusCollectionRevision(
  api: IExtensionApi,
  nexus: Nexus,
): (collectionSlug: string, revisionNumber: number) => Bluebird<IRevision> {
  return (
    collectionSlug: string,
    revisionNumber: number,
  ): Bluebird<IRevision> => {
    if (collectionSlug === undefined) {
      const err = new Error("invalid parameter, collectionSlug undefined");
      err["attachLogOnReport"] = true;
      api.showErrorNotification("invalid parameter", err);
      return Bluebird.resolve(undefined);
    } else if (!Number.isFinite(revisionNumber)) {
      return Bluebird.reject(
        new Error(
          "invalid parameter, revisionNumber has to be a number, " +
            `got: ${revisionNumber}`,
        ),
      );
    }
    return Bluebird.resolve(
      nexus.getCollectionRevisionGraph(
        FULL_REVISION_INFO,
        collectionSlug,
        revisionNumber > 0 ? revisionNumber : undefined,
      ),
    ).catch((err) => {
      const allowReport =
        !err.message.includes("network disconnected") &&
        !err.message.includes(
          "Cannot return null for non-nullable field CollectionRevision.collection",
        ) &&
        err.code !== "COLLECTION_UNDER_MODERATION";
      err["collectionSlug"] = collectionSlug;
      err["revisionNumber"] = revisionNumber;
      if (err.code !== "NOT_FOUND") {
        api.showErrorNotification("Failed to get nexus revision info", err, {
          id: "failed-get-revision-info",
          allowReport,
        });
      }
      return Bluebird.resolve(undefined);
    });
  };
}

function reportRateError(api: IExtensionApi, err: Error, revisionId: number) {
  const loggedIn = isLoggedIn(api.getState());
  const expectedError = resolveGraphError(api.translate, loggedIn, err);
  if (expectedError !== undefined) {
    api.sendNotification({
      type: "info",
      message: expectedError,
      replace: {
        waitingTime: api.translate("12 hours"),
      },
    });
  } else if (err instanceof TimeoutError || err.message.includes("ETIMEDOUT")) {
    const message =
      "A timeout occurred trying to rate a collection, please try again later.";
    api.sendNotification({
      type: "error",
      title: "Timeout",
      message,
      displayMS: calcDuration(message.length),
    });
  } else if (err["code"] === "NOT_FOUND") {
    api.showErrorNotification(
      "Collection not found, it might have been removed.",
      err,
      {
        allowReport: false,
      },
    );
  } else if (
    ["ENOENT", "ECONNRESET", "ECONNABORTED", "ESOCKETTIMEDOUT"].includes(
      err["code"],
    ) ||
    err instanceof ProcessCanceled
  ) {
    api.showErrorNotification(
      "Rating collection failed, please try again later",
      err,
      {
        allowReport: false,
      },
    );
  } else if (err.message.startsWith("getaddrinfo ENOTFOUND")) {
    api.showErrorNotification(
      "Rating collection failed, please try again later",
      err,
      {
        allowReport: false,
      },
    );
  } else {
    const detail = processErrorMessage(err as NexusError);
    detail.Revision = revisionId;
    let allowReport = detail.Servermessage === undefined;
    if (detail.noReport) {
      allowReport = false;
      delete detail.noReport;
    }
    showError(
      api.store.dispatch,
      "An error occurred rating a collection",
      detail,
      { allowReport },
    );
  }
}

interface IRateRevisionResult {
  success: boolean;
  averageRating?: IRating;
}

export function onRateRevision(
  api: IExtensionApi,
  nexus: Nexus,
): (revisionId: number, rating: number) => Bluebird<IRateRevisionResult> {
  return (revisionId: number, rating: any): Bluebird<IRateRevisionResult> => {
    return Bluebird.resolve(nexus.rateRevision(revisionId, rating)).catch(
      (err) => {
        reportRateError(api, err, revisionId);
        return Bluebird.resolve({ success: false });
      },
    );
  };
}

interface IDownloadResult {
  error: Error;
  dlId?: string;
}

export function onGetModFiles(
  api: IExtensionApi,
  nexus: Nexus,
): (...args: any[]) => Bluebird<IFileInfo[]> {
  return (gameId: string, modId: number): Bluebird<IFileInfo[]> => {
    const state = api.getState();
    const game = gameById(state, gameId);
    return Bluebird.resolve(
      nexus.getModFiles(modId, nexusGameId(game, gameId) || gameId),
    )
      .then((result) => result.files)
      .catch((err) => {
        api.showErrorNotification("Failed to get list of mod files", err, {
          allowReport: false,
        });
        return Bluebird.resolve([]);
      });
  };
}

export function onModFileContents(
  api: IExtensionApi,
  nexus: Nexus,
): (...args: any[]) => Bluebird<Partial<IModFileContentPage>> {
  return (
    query: IModFileContentPageQuery,
    filter?: IModFileContentSearchFilter,
    offset?: number,
    count?: number,
  ) => {
    return Bluebird.resolve(
      nexus.modFileContents(query, filter, offset, count),
    ).catch((err) => {
      api.showErrorNotification("Failed to get mod file contents", err, {
        allowReport: false,
      });
      return Bluebird.resolve({});
    });
  };
}

/**
 * Fetches mod requirements (dependencies) from the Nexus Mods API.
 *
 * @param api - The extension API
 * @param nexus - The Nexus API client
 * @returns A function that accepts gameId and modId and returns mod requirements
 *
 */
export function onGetModRequirements(
  api: IExtensionApi,
  nexus: Nexus,
): (gameId: string, modId: number) => Bluebird<Partial<IModRequirements>> {
  return (gameId: string, modId: number) => {
    const state = api.getState();
    const game = gameById(state, gameId);
    const nexusGameDomain = nexusGameId(game, gameId) || gameId;

    return Bluebird.resolve(
      nexus.modRequirements(MOD_REQUIREMENTS_INFO, modId, nexusGameDomain),
    ).catch((err) => {
      if (err instanceof RateLimitError) {
        log("warn", "Rate limited when fetching mod requirements", {
          gameId: nexusGameDomain,
          modId,
        });
      } else if (err instanceof TimeoutError) {
        log("warn", "Timeout when fetching mod requirements", {
          gameId: nexusGameDomain,
          modId,
        });
      } else {
        const detail = processErrorMessage(err);
        api.showErrorNotification("Failed to get mod requirements", detail, {
          allowReport: detail.noReport ? false : true,
        });
      }

      return Bluebird.resolve({
        dlcRequirements: [],
        nexusRequirements: { nodes: [], nodesCount: 0, totalCount: 0 },
        modsRequiringThisMod: { nodes: [], nodesCount: 0, totalCount: 0 },
      });
    });
  };
}

export function onGetUserKeyData(
  api: IExtensionApi,
): (...args: any[]) => Promise<IValidateKeyDataV2> {
  return () => {
    // This doesn't have to be async, as the key data is already in the state
    //  but we keep the Promise interface for consistency + in case we want to
    //  make an async call in the future
    const state: IState = api.getState();
    const userKey = getSafe(
      state,
      ["persistent", "nexus", "userInfo"],
      undefined,
    );
    return Promise.resolve(userKey);
  };
}

export function onGetPreferences(
  api: IExtensionApi,
  nexus: Nexus,
): (...args: any[]) => Promise<Partial<IPreference>> {
  return (query: IPreferenceQuery) => {
    return Promise.resolve(nexus.getPreferences(query)).catch((err) => {
      api.showErrorNotification("Failed to get preferences", err, {
        allowReport: false,
      });
      return Promise.resolve({});
    });
  };
}

export function onDownloadUpdate(
  api: IExtensionApi,
  nexus: Nexus,
): (...args: any[]) => Bluebird<IDownloadResult> {
  return (
    source: string,
    gameId: string,
    modId: string,
    fileId: string,
    versionPattern: string,
    campaign: string,
    referenceTag?: string,
  ): Bluebird<IDownloadResult> => {
    if (source !== "nexus") {
      return Bluebird.resolve(undefined);
    }

    const state = api.getState();
    const game = gameId === SITE_ID ? null : gameById(state, gameId);
    const activeGame = currentGame(state);
    const compatibleDownloads = activeGame?.details?.compatibleDownloads || [];
    const hasCompatibleDownloadId = compatibleDownloads.includes(gameId);
    if (game === undefined && !hasCompatibleDownloadId) {
      api.sendNotification({
        type: "error",
        title: "Invalid game id",
        message: gameId,
      });
      return Bluebird.resolve(undefined);
    }

    const fileIdNum = parseInt(fileId, 10);

    return Bluebird.resolve(
      nexus.getModFiles(
        parseInt(modId, 10),
        nexusGameId(game, gameId) || gameId,
      ),
    )
      .then((files) => {
        let updateFileId: number;

        const updateChain = findLatestUpdate(files.file_updates, [], fileIdNum);
        const newestMatching = updateChain
          // sort newest to oldest
          .sort((lhs, rhs) => rhs.uploaded_timestamp - lhs.uploaded_timestamp)
          // find the first update entry that has a version matching the pattern
          .find((update) => {
            const file = files.files.find(
              (iter) => iter.file_id === update.new_file_id,
            );
            if (file === undefined) {
              return false;
            }
            return (
              versionPattern === "*" ||
              semver.satisfies(semver.coerce(file.version), versionPattern)
            );
          });

        if (newestMatching !== undefined) {
          updateFileId = newestMatching.new_file_id;
        } else {
          // no update chain, maybe we're lucky and there is only a single file not marked
          // as old
          const notOld = files.files.filter(
            (file) => file.category_id !== 4 && file.category_id !== 6,
          );
          if (
            notOld.length === 1 &&
            semver.satisfies(semver.coerce(notOld[0].version), versionPattern)
          ) {
            updateFileId = notOld[0].file_id;
          }
        }

        if (updateFileId === undefined) {
          updateFileId = fileIdNum;
        }

        const urlParsed = new URL(
          `nxm://${toNXMId(game, gameId)}/mods/${modId}/files/${updateFileId}`,
        );
        if (campaign !== undefined) {
          urlParsed.searchParams.set("campaign", campaign);
        }
        const state: IState = api.store.getState();
        const downloads = state.persistent.downloads.files;
        // check if the file is already downloaded. If not, download before starting the install
        const existingId = Object.keys(downloads).find((downloadId) => {
          return (
            getFileId(downloads[downloadId]) === fileIdNum &&
            downloads[downloadId].state !== "failed"
          );
        });

        if (existingId !== undefined) {
          if (downloads[existingId].state === "paused") {
            return Bluebird.fromCallback((cb) =>
              api.events.emit("resume-download", existingId, cb),
            ).then(() => ({ error: null, dlId: existingId }));
          } else {
            return Bluebird.resolve({ error: null, dlId: existingId });
          }
        }

        return startDownload(
          api,
          nexus,
          urlParsed.toString(),
          "never",
          undefined,
          false,
          false,
          referenceTag,
        )
          .then((dlId) => ({ error: null, dlId }))
          .catch((err) => ({ error: err }));
      })
      .catch((err) => {
        if (err instanceof UserCanceled) {
          // there is a really good chance that the download will fail
          log("warn", "failed to fetch mod file list", err.message);
          const urlParsed = new URL(
            `nxm://${toNXMId(game, gameId)}/mods/${modId}/files/${fileId}`,
          );
          if (campaign !== undefined) {
            urlParsed.searchParams.set("campaign", campaign);
          }

          return startDownload(
            api,
            nexus,
            urlParsed.toString(),
            "never",
            undefined,
            false,
            false,
            referenceTag,
          )
            .then((dlId) => ({ error: null, dlId }))
            .catch((innerErr) => ({ error: innerErr }));
        } else {
          return Bluebird.resolve({ error: err });
        }
      });
  };
}

export function onSubmitFeedback(nexus: Nexus) {
  return (
    title: string,
    message: string,
    hash: string,
    feedbackFiles: string[],
    anonymous: boolean,
    callback: (err: Error, response?: IFeedbackResponse) => void,
  ) => {
    submitFeedback(nexus, title, message, feedbackFiles, anonymous, hash)
      .then((response) => callback(null, response))
      .catch((err) => callback(err));
  };
}

function sendCollection(
  nexus: Nexus,
  collectionInfo: ICollectionManifest,
  collectionId: number,
  uuid: string,
) {
  if (collectionId === undefined) {
    return nexus.createCollection(
      {
        adultContent: false,
        collectionManifest: collectionInfo,
        collectionSchemaId: 1,
      },
      uuid,
    );
  } else {
    return nexus
      .editCollection(collectionId as any, collectionInfo.info.name)
      .then(() =>
        nexus.createOrUpdateRevision(
          {
            adultContent: false,
            collectionManifest: collectionInfo,
            collectionSchemaId: 1,
          },
          uuid,
          collectionId,
        ),
      );
  }
}

export function onSubmitCollection(nexus: Nexus) {
  return (
    collectionInfo: ICollectionManifest,
    assetFilePath: string,
    collectionId: number,
    callback: (err: Error, response?: any) => void,
  ) => {
    nexus
      .getRevisionUploadUrl()
      .then(({ url, uuid }) => {
        return fs
          .statAsync(assetFilePath)
          .then((stat) =>
            upload(url, fs.createReadStream(assetFilePath), stat.size),
          )
          .then(() => uuid);
      })
      .then((uuid: string) =>
        sendCollection(nexus, collectionInfo, collectionId, uuid),
      )
      .then((response) => callback(null, response))
      .catch((err) => callback(unknownToError(err)));
  };
}

export function onEndorseMod(api: IExtensionApi, nexus: Nexus) {
  return (gameId: string, modId: string, endorsedStatus: EndorsedStatus) => {
    if (!isLoggedIn(api.getState())) {
      api.showErrorNotification(
        "An error occurred endorsing a mod",
        "You are not logged in to Nexus Mods!",
        { allowReport: false },
      );
    } else {
      endorseThing(api, nexus, gameId, modId, endorsedStatus);
    }
  };
}

export function onEndorseDirect(api: IExtensionApi, nexus: Nexus) {
  return (
    gameId: string,
    nexusId: number,
    version: string,
    endorsedStatus: EndorsedStatus,
  ): Bluebird<EndorsedStatus> => {
    return endorseDirectImpl(
      api,
      nexus,
      gameId,
      nexusId,
      version,
      endorsedStatus,
    ).then((res) => res as EndorsedStatus);
  };
}

function extractLatestModInfo(
  state: IState,
  gameId: string,
  input: IModInfo,
): IModListItem {
  return {
    name: input.name,
    author: input.uploaded_by,
    category: resolveCategoryName(input.category_id.toString(), state),
    summary: input.summary,
    imageUrl: input.picture_url,
    link: `${NEXUS_BASE_URL}/${input.domain_name}/mods/${input.mod_id}`,
    extra: [
      { id: "endorsements", value: input.endorsement_count },
      { id: "downloads", value: input.mod_downloads },
    ],
  };
}

export function onGetLatestMods(api: IExtensionApi, nexus: Nexus) {
  return (
    gameId: string,
  ): Bluebird<{ id: string; encoding: string; mods: IModListItem[] }> => {
    const state = api.getState();
    const gameDomain = nexusGameId(gameById(state, gameId), gameId);
    return Bluebird.resolve(nexus.getLatestAdded(gameDomain)).then((mods) => ({
      id: "nexus",
      encoding: "bbcode",
      mods: mods
        .filter((mod) => !mod.contains_adult_content && mod.available)
        .map((mod) => extractLatestModInfo(state, gameId, mod)),
    }));
  };
}

export function onRefreshUserInfo(nexus: Nexus, api: IExtensionApi) {
  return (): Bluebird<void> => {
    // only called from the global menu item

    //const token = getOAuthTokenFromState(api);

    log("info", "onRefreshUserInfo() started");

    // we have an oauth token in state
    //if(token !== undefined) {
    // get userinfo from api
    return Bluebird.resolve(nexus.getUserInfo())
      .then((apiUserInfo) => {
        api.store.dispatch(setUserInfo(transformUserInfoFromApi(apiUserInfo)));
        log(
          "info",
          "onRefreshUserInfo() nexus.getUserInfo response",
          apiUserInfo,
        );
      })
      .catch((err) => {
        log(
          "error",
          `onRefreshUserInfo() nexus.getUserInfo response ${err.message}`,
          err,
        );
        showError(
          api.store.dispatch,
          "An error occurred refreshing user info",
          err,
          {
            allowReport: false,
          },
        );
      });
    //} else {
    //  log('warn', 'onRefreshUserInfo() no oauth token');
    //}
  };
}

export function onGetTrendingMods(api: IExtensionApi, nexus: Nexus) {
  return (
    gameId: string,
  ): Bluebird<{ id: string; encoding: string; mods: IModListItem[] }> => {
    const state = api.getState();
    const gameDomain = nexusGameId(gameById(state, gameId), gameId);
    return Bluebird.resolve(nexus.getTrending(gameDomain)).then((mods) => ({
      id: "nexus",
      encoding: "bbcode",
      mods: mods
        .filter((mod) => !mod.contains_adult_content && mod.available)
        .map((mod) => extractLatestModInfo(state, gameId, mod)),
    }));
  };
}

export function onAPIKeyChanged(
  api: IExtensionApi,
  nexus: Nexus,
): StateChangeCallback {
  return (oldValue: string, newValue: string) => {
    api.store.dispatch(setUserInfo(undefined));
    if (newValue !== undefined) {
      updateKey(api, nexus, newValue);
    }
  };
}

// fired when state variable changes 'confidential.account.nexus.OAuthCredentials'
export function onOAuthTokenChanged(
  api: IExtensionApi,
  nexus: Nexus,
): StateChangeCallback {
  return (oldValue: ITokenReply, newValue: ITokenReply) => {
    log("info", "onOAuthTokenChanged event handler.");

    // remove user info
    api.store.dispatch(setUserInfo(undefined));

    if (newValue !== undefined) {
      updateToken(api, nexus, newValue);
    }
  };
}

export function onCheckModsVersion(
  api: IExtensionApi,
  nexus: Nexus,
): (...args: any[]) => Bluebird<string[]> {
  return (gameId, mods, forceFull) => {
    if (!isLoggedIn(api.getState())) {
      api.showErrorNotification(
        "An error occurred checking for mod updates",
        "You are not logged in to Nexus Mods!",
        { allowReport: false },
      );
      return Bluebird.resolve([]);
    } else {
      api.store.dispatch(setUpdatingMods(gameId, true));
      const start = Date.now();
      return checkModVersionsImpl(api.store, nexus, gameId, mods, forceFull)
        .then(({ errors, modIds }) => {
          if (errors.length !== 0) {
            showError(
              api.store.dispatch,
              "Some mods could not be checked for updates",
              errors.join("[br][/br]"),
              { allowReport: false, isBBCode: true },
            );
          }
          return Bluebird.resolve(modIds);
        })
        .catch(NexusError, (err) => {
          showError(
            api.store.dispatch,
            "An error occurred checking for mod updates",
            err,
            {
              allowReport: false,
            },
          );
          return Bluebird.resolve([]);
        })
        .catch(TimeoutError, (err) => {
          showError(
            api.store.dispatch,
            "An error occurred checking for mod updates",
            err,
            {
              allowReport: false,
            },
          );
          return Bluebird.resolve([]);
        })
        .catch(RateLimitError, (err) => {
          showError(
            api.store.dispatch,
            "Rate limit exceeded, please try again later",
            err,
            {
              allowReport: false,
            },
          );
          return Bluebird.resolve([]);
        })
        .catch(ProcessCanceled, (err) => {
          showError(
            api.store.dispatch,
            "An error occurred checking for mod updates",
            err,
            {
              allowReport: false,
            },
          );
          return Bluebird.resolve([]);
        })
        .catch((err) => {
          showError(
            api.store.dispatch,
            "An error occurred checking for mod updates",
            err,
          );
          return Bluebird.resolve([]);
        })
        .then((modIds: string[]) =>
          Bluebird.delay(2000 - (Date.now() - start)).then(() => modIds),
        )
        .finally(() => {
          api.store.dispatch(setUpdatingMods(gameId, false));
        });
    }
  };
}

export function sendMetric(api: IExtensionApi, nexus: Nexus) {
  return async (
    eventType: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, any>,
    clientString?: string,
  ) => {
    try {
      await nexus.sendMetric(
        eventType,
        entityType,
        entityId,
        metadata,
        clientString,
      );
    } catch {
      // do nothing
    }
  };
}
