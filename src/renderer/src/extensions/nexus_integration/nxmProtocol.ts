import type { IDownloadURL, IFileUpdate, IRevision, IRevisionQuery } from "@nexusmods/nexus-api";
import type NexusT from "@nexusmods/nexus-api";
import { NexusError, RateLimitError } from "@nexusmods/nexus-api";
import { getErrorMessageOrDefault } from "@vortex/shared";
import { DownloadIsHTML } from "@vortex/shared/errors";
import PromiseBB from "bluebird";
import type { Action } from "redux";

import { setDownloadModInfo } from "../../actions";
import { log } from "../../logging";
import type { IExtensionApi } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import { getCollectionActiveSession } from "../../util/collectionInstallSessionSelectors";
import { markCollectionMemberSkipped } from "../../util/collectionSkip";
import {
  DataInvalid,
  HTTPError,
  ProcessCanceled,
  ServiceTemporarilyUnavailable,
  UserCanceled,
} from "../../util/CustomErrors";
import opn from "../../util/opn";
import { gameById, knownGames } from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";
import { batchDispatch } from "../../util/util";
import type { IResolvedURL } from "../download_management/types/ProtocolHandlers";
import { SITE_ID } from "../gamemode_management/constants";
import { addFreeUserDLItem, removeFreeUserDLItem } from "./actions/session";
import { NEXUS_BASE_URL } from "./constants";
import NXMUrl from "./NXMUrl";
import { bringToFront, ensureLoggedIn, getInfoGraphQL, oauthCallback, startDownload } from "./util";
import { convertNXMIdReverse, nexusGameId } from "./util/convertGameId";

export type ResolveFunc = (input: string) => PromiseBB<IResolvedURL>;

interface IDLQueueItem {
  input: string;
  url: NXMUrl;
  res: (res: IResolvedURL) => void;
  rej: (err: Error) => void;
  queryRelevantUpdates: () => Promise<IFileUpdate[]>;
}

const freeDLQueue: IDLQueueItem[] = [];

const DL_QUERY: IRevisionQuery = {
  id: true,
  revisionNumber: true,
  downloadLink: true,
  collection: {
    id: true,
  },
};

interface IAwaitedLink {
  gameId: string;
  modId: number;
  fileId: number;
  resolve: (url: string) => void;
}

const awaitedLinks: IAwaitedLink[] = [];

function doDownload(api: IExtensionApi, nexus: NexusT, url: string): PromiseBB<string> {
  return (
    startDownload(api, nexus, url)
      .catch(DownloadIsHTML, () => undefined)
      // DataInvalid is used here to indicate invalid user input or invalid
      // data from remote, so it's presumably not a bug in Vortex
      .catch(DataInvalid, () => {
        api.showErrorNotification("Failed to start download", url, {
          allowReport: false,
        });
        return PromiseBB.resolve(undefined);
      })
      .catch(UserCanceled, () => PromiseBB.resolve(undefined))
      .catch((err) => {
        api.showErrorNotification("Failed to start download", err);
        return PromiseBB.resolve(undefined);
      })
  );
}

/**
 * Handle an incoming nxm:// link. `onPremiumLink` runs for the nxm://premium form, which the
 * site opens after a membership change so the client re-reads the user info.
 */
export function makeNXMLinkCallback(api: IExtensionApi, nexus: NexusT, onPremiumLink: () => void) {
  return (url: string, install: boolean) => {
    let nxmUrl: NXMUrl;
    try {
      nxmUrl = new NXMUrl(url);

      const state = api.getState();
      const isExtAvailable =
        state.session.extensions.available.find((iter) => iter.modId === nxmUrl.modId) !==
        undefined;

      if (nxmUrl.type === "oauth") {
        try {
          return oauthCallback(api, nxmUrl.oauthCode, nxmUrl.oauthState);
        } catch (err) {
          // ignore unexpected code
        }
      } else if (nxmUrl.type === "premium") {
        try {
          log("info", "makeNXMLinkCallback() premium");
          onPremiumLink();
          return false;
        } catch (err) {
          // ignore unexpected code
        }
      } else if (nxmUrl.gameId === SITE_ID && isExtAvailable) {
        if (install) {
          return api.emitAndAwait("install-extension", {
            name: "Pending",
            modId: nxmUrl.modId,
            fileId: nxmUrl.fileId,
          });
        } else {
          api.events.emit("show-extension-page", nxmUrl.modId);
          bringToFront();
          return PromiseBB.resolve();
        }
      } else {
        const { foregroundDL } = state.settings.interface;
        if (foregroundDL) {
          bringToFront();
        }
      }
    } catch (err) {
      api.showErrorNotification("Invalid URL", err, { allowReport: false });
      return;
    }

    const awaitedIdx = awaitedLinks.findIndex(
      (link) =>
        link.gameId === nxmUrl.gameId &&
        link.modId === nxmUrl.modId &&
        link.fileId === nxmUrl.fileId,
    );
    if (awaitedIdx !== -1) {
      const awaited = awaitedLinks.splice(awaitedIdx, 1);
      awaited[0].resolve(url);
      return;
    }

    ensureLoggedIn(api)
      .then(() => doDownload(api, nexus, url))
      .then((dlId) => {
        if (dlId === undefined || dlId === null) {
          return PromiseBB.resolve(undefined);
        }

        const actions: Action[] = [setDownloadModInfo(dlId, "source", "nexus")];
        if (nxmUrl.collectionId !== undefined) {
          actions.push(setDownloadModInfo(dlId, "collectionId", nxmUrl.collectionId));
        }
        if (nxmUrl.revisionId !== undefined) {
          actions.push(setDownloadModInfo(dlId, "revisionId", nxmUrl.revisionId));
        }
        if (nxmUrl.collectionSlug !== undefined) {
          actions.push(setDownloadModInfo(dlId, "collectionSlug", nxmUrl.collectionSlug));
        }
        if (nxmUrl.revisionNumber !== undefined && nxmUrl.revisionNumber > 0) {
          actions.push(setDownloadModInfo(dlId, "revisionNumber", nxmUrl.revisionNumber));
        }
        batchDispatch(api.store, actions);

        return new PromiseBB((resolve, reject) => {
          const currentState: IState = api.store.getState();
          const download = currentState.persistent.downloads.files[dlId];
          if (download === undefined) {
            return reject(new ProcessCanceled(`Download not found "${dlId}"`));
          }
          // collections always get installed automatically.
          if (install && nxmUrl.type !== "collection") {
            api.events.emit("start-install-download", dlId, (err: Error, id: string) => {
              if (err !== null) {
                reject(err);
              } else {
                resolve();
              }
            });
          } else {
            resolve();
          }
        });
      })
      // doDownload handles all download errors so the catches below are
      //  only for log in errors
      .catch(UserCanceled, () => null)
      .catch(ProcessCanceled, (err) => {
        api.showErrorNotification("Log-in failed", err, {
          id: "failed-get-nexus-key",
          allowReport: false,
        });
      })
      .catch(ServiceTemporarilyUnavailable, (err) => {
        api.showErrorNotification("Service temporarily unavailable", err, {
          id: "failed-get-nexus-key",
          allowReport: false,
        });
      })
      .catch((err) => {
        api.showErrorNotification("Failed to get access key", err, {
          id: "failed-get-nexus-key",
        });
      });
  };
}

export function makeNXMProtocol(api: IExtensionApi, nexus: NexusT): ResolveFunc {
  // for free users a dialog needs to be displayed sending them to the site for the download.
  // if we start multiple downloads in parallel, these are shown one by one but if the user cancels
  // the dialog, we want to cancel all queued downloads, otherwise the client code can't cancel
  // out of the larger process without the user having to click cancel multiple times.
  // Thus we have to keep track of all queued downloads.

  function freeUserDownload(input: string, url: NXMUrl) {
    // non-premium user trying to download a file with no id, have to send the user to the
    // corresponding site to generate a proper link
    return new PromiseBB<IResolvedURL>((resolve, reject) => {
      const res = (result: IResolvedURL) => {
        if (resolve !== undefined) {
          // just to make sure we remove the correct item, idx should always be 0
          const idx = freeDLQueue.findIndex((iter) => iter.input === input);
          api.store.dispatch(removeFreeUserDLItem(input));
          freeDLQueue.splice(idx, 1);
          resolve(result);
          reject = undefined;
          resolve = undefined;
        }
      };
      const rej = (err) => {
        if (reject !== undefined) {
          const idx = freeDLQueue.findIndex((iter) => iter.input === input);
          api.store.dispatch(removeFreeUserDLItem(input));
          freeDLQueue.splice(idx, 1);
          reject(err);
          reject = undefined;
          resolve = undefined;
        }
      };
      const queryRelevantUpdates = () => {
        return nexus.getModFiles(url.modId, url.gameId).then((files) => {
          // Build a bidirectional map for O(1) lookups, we're doing this
          //  in the hope that the mod authors have kept a clear update chain
          //  which we can use to find relevant fileIds.
          // It's not cool that we're consuming an API slot for this, but without this
          //  we can't reliably compare the dependency reference to what we're attempting
          //  to skip (we only have the NXM url which isn't enough).
          const forwardMap = new Map<number, IFileUpdate>(); // old_file_id -> update
          const backwardMap = new Map<number, IFileUpdate>(); // new_file_id -> update

          files.file_updates.forEach((update) => {
            forwardMap.set(update.old_file_id, update);
            backwardMap.set(update.new_file_id, update);
          });

          // Traverse backwards to find the oldest file in the chain
          let currentId = url.fileId;
          const backwardChain: IFileUpdate[] = [];

          while (backwardMap.has(currentId)) {
            const update = backwardMap.get(currentId);
            backwardChain.unshift(update); // Add to beginning
            currentId = update.old_file_id;
          }

          // Now traverse forwards from the oldest file to build complete chain
          const oldestId = backwardChain.length > 0 ? backwardChain[0].old_file_id : url.fileId;
          currentId = oldestId;
          const completeChain: IFileUpdate[] = [];

          while (forwardMap.has(currentId)) {
            const update = forwardMap.get(currentId);
            completeChain.push(update);
            currentId = update.new_file_id;
          }

          return completeChain;
        });
      };
      freeDLQueue.push({ input, url, res, rej, queryRelevantUpdates });
      api.store.dispatch(addFreeUserDLItem(input));
    });
  }

  // Cache download URLs to avoid repeated API calls for the same file
  const downloadURLCache: {
    [key: string]: { urls: string[]; expires: number; meta: any };
  } = {};
  const DOWNLOAD_URL_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  function premiumUserDownload(
    input: string,
    url: NXMUrl,
    directDownloadEnabled: boolean = false,
  ): PromiseBB<IResolvedURL> {
    const state = api.getState();
    const games = knownGames(state);
    const gameId = convertNXMIdReverse(games, url.gameId);
    const pageId = nexusGameId(gameById(state, gameId), url.gameId);
    let revisionInfo: Partial<IRevision>;

    const revNumber = url.revisionNumber >= 0 ? url.revisionNumber : undefined;

    if (!["mod", "collection"].includes(url.type)) {
      return PromiseBB.reject(new ProcessCanceled("Not a download url"));
    }

    // Create cache key
    const cacheKey =
      url.type === "mod"
        ? `mod_${url.modId}_${url.fileId}_${pageId}`
        : `collection_${url.collectionSlug}_${revNumber || "latest"}`;

    // Check cache first
    const cached = downloadURLCache[cacheKey];
    if (cached && Date.now() < cached.expires) {
      return PromiseBB.resolve({
        urls: cached.urls,
        updatedUrl: input,
        meta: cached.meta,
      });
    }

    const downloadKey = directDownloadEnabled ? undefined : url.key;
    const downloadExpires = directDownloadEnabled ? undefined : url.expires;

    return PromiseBB.resolve()
      .then(() =>
        url.type === "mod"
          ? nexus
              .getDownloadURLs(url.modId, url.fileId, downloadKey, downloadExpires, pageId)
              .then((res: IDownloadURL[]) => {
                const result = {
                  urls: res.map((u) => u.URI),
                  updatedUrl: input,
                  meta: {
                    source: "nexus",
                    nexus: {
                      ids: {
                        modId: url.modId,
                        fileId: url.fileId,
                      },
                    },
                  } as any,
                };

                // Cache the result
                downloadURLCache[cacheKey] = {
                  urls: result.urls,
                  expires: Date.now() + DOWNLOAD_URL_CACHE_DURATION,
                  meta: result.meta,
                };

                return result;
              })
          : nexus
              .getCollectionRevisionGraph(DL_QUERY, url.collectionSlug, revNumber)
              .catch((err) => {
                err["collectionSlug"] = url.collectionSlug;
                err["revisionNumber"] = url.revisionNumber;
                return PromiseBB.reject(err);
              })
              .then((revision: Partial<IRevision>) => {
                revisionInfo = revision;
                return nexus.getCollectionDownloadLink(revision.downloadLink);
              })
              .then((downloadUrls) => {
                const result = {
                  urls: downloadUrls.map((iter) => iter.URI),
                  updatedUrl: input,
                  meta: {
                    source: "nexus",
                    nexus: {
                      ids: {
                        collectionId: revisionInfo.collection.id,
                        revisionId: revisionInfo.id,
                        collectionSlug: url.collectionSlug,
                        revisionNumber: revisionInfo.revisionNumber ?? url.revisionNumber,
                      },
                    },
                  } as any,
                };

                // Cache the result
                downloadURLCache[cacheKey] = {
                  urls: result.urls,
                  expires: Date.now() + DOWNLOAD_URL_CACHE_DURATION,
                  meta: result.meta,
                };

                return result;
              }),
      )
      .catch(NexusError, (err) => {
        const newError = new HTTPError(err.statusCode, err.message, err.request);
        newError.stack = err.stack;
        return PromiseBB.reject(newError);
      })
      .catch(HTTPError, (err) => {
        // A 401 here means the Nexus client could not authenticate the
        // request and could not (or did not) refresh its token. Reachable
        // when persisted state says we have OAuth credentials but the live
        // Nexus instance does not (e.g. updateToken never ran on startup,
        // forced-logout migration path), when the refresh token has been
        // revoked server-side, or on a resume after logout. Surface as a
        // ProcessCanceled so reportDownloadError shows a friendly,
        // non-reportable notification instead of letting the raw 401 fall
        // through to the generic else branch with the Report button.
        if (err.statusCode === 401) {
          return PromiseBB.reject(new ProcessCanceled("You are not logged in to Nexus Mods!"));
        }
        return PromiseBB.reject(err);
      })
      .catch(RateLimitError, (err) => {
        api.showErrorNotification("Rate limit exceeded", err, {
          allowReport: false,
        });
        return PromiseBB.reject(err);
      });
  }

  const resolveFunc = (input: string): PromiseBB<IResolvedURL> => {
    const state = api.store.getState();

    let url: NXMUrl;
    try {
      url = new NXMUrl(input);
    } catch (err) {
      return PromiseBB.reject(err);
    }

    const userInfo: any = getSafe(state, ["persistent", "nexus", "userInfo"], undefined);
    if (url.userId !== undefined && url.userId !== userInfo?.userId) {
      const userName: string = getSafe(
        state,
        ["persistent", "nexus", "userInfo", "name"],
        undefined,
      );
      api.showErrorNotification(
        "Invalid download links",
        "The link was not created for this account ({{userName}}). " +
          "You have to be logged into nexusmods.com with the same account that you use in Vortex.",
        { allowReport: false, replace: { userName } },
      );
      return PromiseBB.reject(new ProcessCanceled("Wrong user id"));
    }

    if (
      (!userInfo?.isPremium || process.env["FORCE_FREE_DOWNLOADS"] === "yes") &&
      url.type === "mod" &&
      url.gameId !== SITE_ID &&
      url.key === undefined
    ) {
      const games = knownGames(state);
      const gameId = convertNXMIdReverse(games, url.gameId);
      const pageId = nexusGameId(gameById(state, gameId), url.gameId);

      return getInfoGraphQL(nexus, pageId, url.modId, url.fileId)
        .then(({ modInfo, fileInfo }) => {
          if (modInfo["direct_download_enabled"]) {
            return premiumUserDownload(input, url, true);
          } else {
            return freeUserDownload(input, url);
          }
        })
        .catch((err) => {
          const message = getErrorMessageOrDefault(err);
          // Cancellation must propagate; otherwise sibling deps whose in-flight
          // mod-info queries get aborted re-enter freeUserDownload, repopulate
          // the queue, and the dialog re-opens behind the one the user just
          // dismissed.
          if (err instanceof UserCanceled || err instanceof ProcessCanceled) {
            return PromiseBB.reject(err);
          }
          // If we can't query mod info, fall back to free user flow
          log("warn", "failed to query mod info for direct download check", {
            error: message,
          });
          return freeUserDownload(input, url);
        });
    } else {
      return premiumUserDownload(input, url);
    }
  };

  return resolveFunc;
}

export function onUpdated() {
  bringToFront();
}

export function onDownloadImpl(resolveFunc: ResolveFunc, inputUrl: string) {
  const queueItem = freeDLQueue.find((iter) => iter.input === inputUrl);
  if (queueItem === undefined) {
    log("error", "failed to find queue item", {
      inputUrl,
      queue: JSON.stringify(freeDLQueue),
    });
    return;
  }
  const { url } = queueItem;

  awaitedLinks.push({
    gameId: url.gameId,
    modId: url.modId,
    fileId: url.fileId,
    resolve: (resUrl: string) => resolveFunc(resUrl).then(queueItem.res).catch(queueItem.rej),
  });

  opn(
    `${NEXUS_BASE_URL}/${url.gameId}/mods/${url.modId}?tab=files&file_id=${url.fileId}&nmm=1`,
  ).catch(() => null);
}

export function onSkip(api: IExtensionApi, inputUrl: string) {
  const queueItem = freeDLQueue.find((iter) => iter.input === inputUrl);
  if (queueItem !== undefined) {
    queueItem
      .queryRelevantUpdates()
      .then((updates) => {
        const fileIdSet = new Set<string>();
        const fileNames = new Set<string>();
        fileIdSet.add(queueItem.url.fileId.toString());
        updates.forEach((update) => {
          if (update.old_file_id != null) {
            fileIdSet.add(update.old_file_id.toString());
            fileNames.add(update.old_file_name);
          }
          if (update.new_file_id != null) {
            fileIdSet.add(update.new_file_id.toString());
            fileNames.add(update.new_file_name);
          }
        });
        const parsed = new NXMUrl(queueItem.input);
        const itemIdentifiers = {
          ...parsed.identifiers,
          fileNames: Array.from(fileNames),
          fileIds: Array.from(fileIdSet),
        };
        // collections is now core, so the skip site dispatches the ignore directly against the
        // active install session rather than emitting an event for the InstallDriver to handle
        markCollectionMemberSkipped(api, { identifiers: itemIdentifiers });
        queueItem.rej(new UserCanceled(true));
      })
      .catch((err) => {
        log("warn", "failed to query relevant updates on skip", {
          error: getErrorMessageOrDefault(err),
        });
        queueItem.rej(new UserCanceled(true));
      });
  }
}

export function onRetryImpl(resolveFunc: ResolveFunc, api: IExtensionApi, inputUrl: string) {
  const queueItem = freeDLQueue.find((iter) => iter.input === inputUrl);
  if (queueItem === undefined) {
    log("error", "failed to find queue item", {
      inputUrl,
      queue: JSON.stringify(freeDLQueue),
    });
    return;
  }

  resolveFunc(queueItem.input).then(queueItem.res).catch(queueItem.rej);
}

export function onCancelImpl(api: IExtensionApi, inputUrl: string): boolean {
  const copy = freeDLQueue.slice(0);
  if (copy.length !== 0) {
    copy.forEach((item) => {
      item.rej(new UserCanceled(false));
    });
    // Rejecting freeDLQueue items dismisses the dialog but doesn't stop the
    // install pipeline (its UserCanceled doesn't survive IPC). pause-collection
    // routes through the collections plugin for the full cleanup: stop queuing,
    // reset the driver, dismiss the install notification.
    const session = getCollectionActiveSession(api.getState());
    if (session?.collectionId && session.gameId) {
      api.events.emit("pause-collection", session.gameId, session.collectionId, "free-user-cancel");
    }
    return true;
  } else {
    api.store.dispatch(removeFreeUserDLItem(inputUrl));
    return false;
  }
}
