import type { IDownloadURL, IFileUpdate, IRevision, IRevisionQuery } from "@nexusmods/nexus-api";
import type NexusT from "@nexusmods/nexus-api";
import { NexusError, RateLimitError } from "@nexusmods/nexus-api";
import { getErrorMessageOrDefault } from "@vortex/shared";
import { DownloadIsHTML } from "@vortex/shared/errors";
import type { Action } from "redux";

import { setDownloadModInfo } from "../../actions";
import { log } from "../../logging";
import type { IExtensionApi } from "../../types/IExtensionContext";
import { getCollectionActiveSession } from "../../util/collectionInstallSessionSelectors";
import { markCollectionMemberSkipped } from "../../util/collectionSkip";
import {
  DataInvalid,
  HTTPError,
  ProcessCanceled,
  ServiceTemporarilyUnavailable,
  UserCanceled,
} from "../../util/CustomErrors";
import { createKeyedCache } from "../../util/keyedCache";
import opn from "../../util/opn";
import { batchDispatch } from "../../util/util";
import type { IResolvedURL } from "../download_management/types/ProtocolHandlers";
import { SITE_ID } from "../gamemode_management/constants";
import { addFreeUserDLItem, removeFreeUserDLItem } from "./actions/session";
import { NEXUS_BASE_URL } from "./constants";
import NXMUrl from "./NXMUrl";
import { isPremium, userInfo } from "./selectors";
import { bringToFront, ensureLoggedIn, getInfoGraphQL, oauthCallback, startDownload } from "./util";
import { findLatestUpdate } from "./util/checkModsVersion";
import { nxmPageId } from "./util/convertGameId";

const DL_QUERY: IRevisionQuery = {
  id: true,
  downloadLink: true,
  collection: {
    id: true,
  },
};

const DOWNLOAD_URL_CACHE_DURATION = 5 * 60 * 1000;

/** A download parked until the user fetches an authorised link from the website. */
interface IQueuedDownload {
  input: string;
  url: NXMUrl;
  resolve: (res: IResolvedURL) => void;
  reject: (err: Error) => void;
  /** The file's update chain, used to describe what a skip is skipping. */
  queryRelevantUpdates: () => Promise<IFileUpdate[]>;
  /** Whether the user has been sent to the website to fetch an authorised link for this one. */
  awaitingLink: boolean;
}

/** What one download-url lookup found: the cdn urls plus the nexus ids identifying them. */
interface IFoundDownload {
  urls: IDownloadURL[];
  ids: Record<string, unknown>;
}

export interface INxmProtocolDeps {
  /** Re-read the account's membership. The site opens nxm://premium after a membership change. */
  onRefreshMembership: () => void;
}

/** The handlers FreeUserDLDialog is wired to. */
export interface IFreeUserDialogHandlers {
  onUpdated: () => void;
  onDownload: (inputUrl: string) => void;
  onSkip: (inputUrl: string) => void;
  onCancel: (inputUrl: string) => boolean;
  onRetry: (inputUrl: string) => void;
}

/**
 * A free user can't ask the api for a download link, so only a keyless link to a mod file on a
 * real game can ever need the website round trip. Collections, extensions from the site domain,
 * and links the website already authorised go straight to the api.
 */
function needsAuthorisedLink(url: NXMUrl): boolean {
  return url.type === "mod" && url.gameId !== SITE_ID && url.key === undefined;
}

/**
 * Resolves nxm:// urls to something the downloader can fetch, and owns the queue of downloads
 * parked while a free user fetches an authorised link from the website.
 *
 * One instance owns the whole queue, because a cancel rejects every download in it: the queued
 * downloads are shown one dialog at a time, so cancelling has to mean "get me out of this
 * install", not "dismiss this one dialog".
 */
export class NxmProtocol {
  readonly #api: IExtensionApi;
  readonly #getNexus: () => NexusT;
  readonly #deps: INxmProtocolDeps;

  // every parked download, each carrying whether its user has gone to fetch a link for it
  readonly #freeQueue: IQueuedDownload[] = [];
  readonly #urlCache = createKeyedCache<{ urls: string[]; meta: unknown }>(
    DOWNLOAD_URL_CACHE_DURATION,
  );

  /**
   * `getNexus` is read on each use: the extension registers its protocol handlers during init,
   * and only builds the Nexus connection later, in its `once` callback.
   */
  constructor(api: IExtensionApi, getNexus: () => NexusT, deps: INxmProtocolDeps) {
    this.#api = api;
    this.#getNexus = getNexus;
    this.#deps = deps;
  }

  get #nexus(): NexusT {
    return this.#getNexus();
  }

  /** Registered as the download protocol handler for the nxm scheme. */
  readonly resolve = async (input: string): Promise<IResolvedURL> => {
    const url = new NXMUrl(input);

    const cached = userInfo(this.#api.getState());
    if (url.userId !== undefined && url.userId !== cached?.userId) {
      this.#api.showErrorNotification(
        "Invalid download links",
        "The link was not created for this account ({{userName}}). " +
          "You have to be logged into nexusmods.com with the same account that you use in Vortex.",
        { allowReport: false, replace: { userName: cached?.name } },
      );
      throw new ProcessCanceled("Wrong user id");
    }

    // resolved once and threaded through: it costs two scans of the known-games list
    const pageId = nxmPageId(this.#api.getState(), url.gameId);

    if (this.#canDownloadInApp(url) || (await this.#isDirectDownload(url, pageId))) {
      return this.#apiDownload(input, url, pageId);
    }

    return this.#websiteDownload(input, url);
  };

  /**
   * Whether the author opted this mod into direct downloads, which makes it free for everyone.
   * Only the website knows, so a lookup we can't complete counts as "no".
   */
  async #isDirectDownload(url: NXMUrl, pageId: string): Promise<boolean> {
    try {
      const { modInfo } = await getInfoGraphQL(this.#nexus, pageId, url.modId, url.fileId);
      return modInfo["direct_download_enabled"] === true;
    } catch (err) {
      // Cancellation must propagate; otherwise sibling deps whose in-flight mod-info queries get
      // aborted re-enter the queue, and the dialog re-opens behind the one the user just dismissed.
      if (err instanceof UserCanceled || err instanceof ProcessCanceled) {
        throw err;
      }
      log("warn", "failed to query mod info for direct download check", {
        error: getErrorMessageOrDefault(err),
      });
      return false;
    }
  }

  /** Registered as the OS handler for nxm:// links. */
  readonly handleLink = (url: string, install: boolean) => {
    let nxmUrl: NXMUrl;
    try {
      nxmUrl = new NXMUrl(url);

      const state = this.#api.getState();

      if (nxmUrl.type === "oauth") {
        return oauthCallback(this.#api, nxmUrl.oauthCode, nxmUrl.oauthState);
      } else if (nxmUrl.type === "premium") {
        log("info", "nxm premium link, re-reading the membership");
        this.#deps.onRefreshMembership();
        return false;
      } else if (nxmUrl.gameId === SITE_ID && this.#isExtensionAvailable(nxmUrl.modId)) {
        if (install) {
          return this.#api.emitAndAwait("install-extension", {
            name: "Pending",
            modId: nxmUrl.modId,
            fileId: nxmUrl.fileId,
          });
        }
        this.#api.events.emit("show-extension-page", nxmUrl.modId);
        bringToFront();
        return Promise.resolve();
      } else if (state.settings.interface.foregroundDL) {
        bringToFront();
      }
    } catch (err) {
      this.#api.showErrorNotification("Invalid URL", err, { allowReport: false });
      return;
    }

    if (this.#deliverAwaitedLink(nxmUrl, url)) {
      return;
    }

    void this.#startLinkDownload(nxmUrl, url, install);
  };

  readonly dialogHandlers: IFreeUserDialogHandlers = {
    onUpdated: bringToFront,

    /** Send the user to the file's page to generate an authorised link. */
    onDownload: (inputUrl: string) => {
      const queued = this.#queuedFor(inputUrl);
      if (queued === undefined) {
        return;
      }
      const { url } = queued;

      queued.awaitingLink = true;

      opn(
        `${NEXUS_BASE_URL}/${url.gameId}/mods/${url.modId}?tab=files&file_id=${url.fileId}&nmm=1`,
      ).catch(() => null);
    },

    onSkip: (inputUrl: string) => {
      const queued = this.#queuedFor(inputUrl);
      if (queued === undefined) {
        return;
      }
      void this.#skipQueued(queued);
    },

    /** Cancels every queued download, not just this one. Returns whether there was any. */
    onCancel: (inputUrl: string): boolean => {
      if (this.#freeQueue.length === 0) {
        this.#api.store.dispatch(removeFreeUserDLItem(inputUrl));
        return false;
      }

      this.#freeQueue.slice().forEach((queued) => queued.reject(new UserCanceled(false)));

      // Rejecting the queued downloads dismisses the dialog but doesn't stop the install pipeline
      // (their UserCanceled doesn't survive IPC). pause-collection routes through the collections
      // plugin for the full cleanup: stop queuing, reset the driver, dismiss the notification.
      const session = getCollectionActiveSession(this.#api.getState());
      if (session?.collectionId && session.gameId) {
        this.#api.events.emit(
          "pause-collection",
          session.gameId,
          session.collectionId,
          "free-user-cancel",
        );
      }
      return true;
    },

    /** Re-resolve a queued download, e.g. after the user upgraded to premium. */
    onRetry: (inputUrl: string) => {
      const queued = this.#queuedFor(inputUrl);
      if (queued === undefined) {
        return;
      }
      this.resolve(queued.input).then(queued.resolve, queued.reject);
    },
  };

  /** Whether this download can go through the api, or has to go via the website. */
  #canDownloadInApp(url: NXMUrl): boolean {
    if (!needsAuthorisedLink(url)) {
      return true;
    }
    if (process.env["FORCE_FREE_DOWNLOADS"] === "yes") {
      return false;
    }
    return isPremium(this.#api.getState());
  }

  /** Whether the site offers an extension with this mod id. */
  #isExtensionAvailable(modId: number): boolean {
    const available = this.#api.getState().session.extensions.available;
    return available.find((iter) => iter.modId === modId) !== undefined;
  }

  #queuedFor(inputUrl: string): IQueuedDownload | undefined {
    const queued = this.#freeQueue.find((iter) => iter.input === inputUrl);
    if (queued === undefined) {
      log("error", "failed to find queued download", {
        inputUrl,
        queued: this.#freeQueue.map((iter) => iter.input),
      });
    }
    return queued;
  }

  /**
   * Forget a queued download, including any link the user was sent to the website to fetch for
   * it - otherwise an abandoned trip to the website leaves an entry that never expires, holding
   * the settled download alive and re-resolving it if a matching link ever does arrive.
   */
  #dequeue(input: string): void {
    // the entry may already be gone
    const queuedIdx = this.#freeQueue.findIndex((iter) => iter.input === input);
    if (queuedIdx !== -1) {
      this.#freeQueue.splice(queuedIdx, 1);
    }
    // the queue is keyed by url, so one row can stand for two downloads of the same file; it goes
    // when the last of them settles, or the survivor is left parked with nothing to release it
    if (!this.#freeQueue.some((iter) => iter.input === input)) {
      this.#api.store.dispatch(removeFreeUserDLItem(input));
    }
  }

  /**
   * Park the download until the user brings back an authorised link from the website (or cancels
   * or skips it). FreeUserDLDialog renders off the redux queue this dispatches into.
   */
  #websiteDownload(input: string, url: NXMUrl): Promise<IResolvedURL> {
    // a promise settles once and #dequeue tolerates a repeat, so cancelling after a skip is safe
    return new Promise<IResolvedURL>((resolve, reject) => {
      this.#freeQueue.push({
        input,
        url,
        resolve: (res) => {
          this.#dequeue(input);
          resolve(res);
        },
        reject: (err) => {
          this.#dequeue(input);
          reject(err);
        },
        queryRelevantUpdates: () => this.#relevantUpdates(url),
        awaitingLink: false,
      });
      this.#api.store.dispatch(addFreeUserDLItem(input));
    });
  }

  /**
   * The file's full update chain. Skipping has to name every file id the chain covers, because a
   * dependency may reference an older or newer file than the one being skipped and the nxm url
   * alone can't tell us which.
   */
  async #relevantUpdates(url: NXMUrl): Promise<IFileUpdate[]> {
    const files = await this.#nexus.getModFiles(url.modId, url.gameId);

    const previous = new Map<number, IFileUpdate>(); // new_file_id -> update
    files.file_updates.forEach((update) => previous.set(update.new_file_id, update));

    // walk back to the oldest file in the chain, then forward over the whole of it
    let oldestId = url.fileId;
    while (previous.has(oldestId)) {
      oldestId = previous.get(oldestId).old_file_id;
    }
    return findLatestUpdate(files.file_updates, [], oldestId);
  }

  async #skipQueued(queued: IQueuedDownload): Promise<void> {
    const fileIds = new Set<string>([queued.url.fileId.toString()]);
    const fileNames = new Set<string>();
    try {
      const updates = await queued.queryRelevantUpdates();
      updates.forEach((update) => {
        if (update.old_file_id != null) {
          fileIds.add(update.old_file_id.toString());
          fileNames.add(update.old_file_name);
        }
        if (update.new_file_id != null) {
          fileIds.add(update.new_file_id.toString());
          fileNames.add(update.new_file_name);
        }
      });

      // the skip dispatches the ignore directly against the active install session
      markCollectionMemberSkipped(this.#api, {
        identifiers: {
          ...queued.url.identifiers,
          fileNames: Array.from(fileNames),
          fileIds: Array.from(fileIds),
        },
      });
    } catch (err) {
      log("warn", "failed to query relevant updates on skip", {
        error: getErrorMessageOrDefault(err),
      });
    }
    queued.reject(new UserCanceled(true));
  }

  /** Ask the api for the download urls, serving a recent answer for the same file from cache. */
  async #apiDownload(input: string, url: NXMUrl, pageId: string): Promise<IResolvedURL> {
    if (!["mod", "collection"].includes(url.type)) {
      throw new ProcessCanceled("Not a download url");
    }

    const revisionNumber = url.revisionNumber >= 0 ? url.revisionNumber : undefined;
    const cacheKey =
      url.type === "mod"
        ? `mod_${url.modId}_${url.fileId}_${pageId}`
        : `collection_${url.collectionSlug}_${revisionNumber ?? "latest"}`;

    const cached = this.#urlCache.get(cacheKey);
    if (cached !== undefined) {
      return { urls: cached.urls, updatedUrl: input, meta: cached.meta };
    }

    let found: IFoundDownload;
    try {
      found =
        url.type === "mod"
          ? await this.#modDownload(url, pageId)
          : await this.#collectionDownload(url, revisionNumber);
    } catch (err) {
      this.#throwDownloadError(err);
    }

    const resolved: IResolvedURL = {
      urls: found.urls.map((iter) => iter.URI),
      updatedUrl: input,
      meta: { source: "nexus", nexus: { ids: found.ids } } as IResolvedURL["meta"],
    };

    this.#urlCache.set(cacheKey, { urls: resolved.urls, meta: resolved.meta });
    return resolved;
  }

  async #modDownload(url: NXMUrl, pageId: string): Promise<IFoundDownload> {
    return {
      urls: await this.#nexus.getDownloadURLs(url.modId, url.fileId, url.key, url.expires, pageId),
      ids: { modId: url.modId, fileId: url.fileId },
    };
  }

  async #collectionDownload(
    url: NXMUrl,
    revisionNumber: number | undefined,
  ): Promise<IFoundDownload> {
    let revision: Partial<IRevision>;
    try {
      revision = await this.#nexus.getCollectionRevisionGraph(
        DL_QUERY,
        url.collectionSlug,
        revisionNumber,
      );
    } catch (err) {
      err["collectionSlug"] = url.collectionSlug;
      err["revisionNumber"] = url.revisionNumber;
      throw err;
    }

    return {
      urls: await this.#nexus.getCollectionDownloadLink(revision.downloadLink),
      ids: {
        collectionId: revision.collection.id,
        revisionId: revision.id,
        collectionSlug: url.collectionSlug,
        revisionNumber: url.revisionNumber,
      },
    };
  }

  /** Rethrow an api failure as the error the download pipeline knows how to report. */
  #throwDownloadError(err: unknown): never {
    if (err instanceof RateLimitError) {
      this.#api.showErrorNotification("Rate limit exceeded", err, { allowReport: false });
      throw err;
    }

    let error = err;
    if (error instanceof NexusError) {
      const http = new HTTPError(error.statusCode, error.message, error.request);
      http.stack = error.stack;
      error = http;
    }

    // A 401 means the Nexus client could not authenticate the request and could not (or did not)
    // refresh its token. Reachable when persisted state says we have OAuth credentials but the
    // live Nexus instance does not (e.g. updateToken never ran on startup, forced-logout migration
    // path), when the refresh token has been revoked server-side, or on a resume after logout.
    // Surface as a ProcessCanceled so reportDownloadError shows a friendly, non-reportable
    // notification instead of a raw 401 behind a Report button.
    if (error instanceof HTTPError && error.statusCode === 401) {
      throw new ProcessCanceled("You are not logged in to Nexus Mods!");
    }
    throw error;
  }

  /** Hand an incoming link to the queued download that sent the user to fetch it. */
  #deliverAwaitedLink(nxmUrl: NXMUrl, url: string): boolean {
    const queued = this.#freeQueue.find(
      (awaited) =>
        awaited.awaitingLink &&
        awaited.url.gameId === nxmUrl.gameId &&
        awaited.url.modId === nxmUrl.modId &&
        awaited.url.fileId === nxmUrl.fileId,
    );
    if (queued === undefined) {
      return false;
    }
    // the link has arrived, so stop treating it as outstanding; resolving dequeues the download
    queued.awaitingLink = false;
    this.resolve(url).then(queued.resolve, queued.reject);
    return true;
  }

  async #startLinkDownload(nxmUrl: NXMUrl, url: string, install: boolean): Promise<void> {
    try {
      await ensureLoggedIn(this.#api);
    } catch (err) {
      this.#reportLinkError(err);
      return;
    }

    // #download reports its own failures, resolving to undefined when nothing was started
    const dlId = await this.#download(url);
    if (dlId == null) {
      return;
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
    batchDispatch(this.#api.store, actions);

    if (this.#api.getState().persistent.downloads.files[dlId] === undefined) {
      this.#reportLinkError(new ProcessCanceled(`Download not found "${dlId}"`));
      return;
    }

    // collections always get installed automatically
    if (install && nxmUrl.type !== "collection") {
      this.#api.events.emit("start-install-download", dlId, (err: Error) => {
        if (err !== null) {
          this.#reportLinkError(err);
        }
      });
    }
  }

  /** Start a download, reporting any failure here. Resolves to undefined when none started. */
  async #download(url: string): Promise<string | undefined> {
    try {
      return await startDownload(this.#api, this.#nexus, url);
    } catch (err) {
      if (err instanceof DownloadIsHTML || err instanceof UserCanceled) {
        return undefined;
      }
      // DataInvalid indicates invalid user input or invalid data from remote, so it's
      // presumably not a bug in Vortex
      if (err instanceof DataInvalid) {
        this.#api.showErrorNotification("Failed to start download", url, { allowReport: false });
        return undefined;
      }
      this.#api.showErrorNotification("Failed to start download", err);
      return undefined;
    }
  }

  #reportLinkError(err: unknown): void {
    if (err instanceof UserCanceled) {
      return;
    }
    if (err instanceof ProcessCanceled) {
      this.#api.showErrorNotification("Log-in failed", err, {
        id: "failed-get-nexus-key",
        allowReport: false,
      });
      return;
    }
    if (err instanceof ServiceTemporarilyUnavailable) {
      this.#api.showErrorNotification("Service temporarily unavailable", err, {
        id: "failed-get-nexus-key",
        allowReport: false,
      });
      return;
    }
    this.#api.showErrorNotification("Failed to get access key", err, {
      id: "failed-get-nexus-key",
    });
  }
}
