import type {
  WireDownloadState,
  WireResolvedResource,
} from "@vortex/shared/ipc";

import { unknownToError } from "@vortex/shared";
import {
  AlreadyDownloaded,
  DownloadIsHTML,
  HTTPError,
  UserCanceled,
  DownloadError,
} from "@vortex/shared/errors";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, rename, rm } from "node:fs/promises";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";
import { z } from "zod";

import type { IExtensionApi } from "./types/IExtensionContext";

import {
  clearDownloadCheckpoint,
  setDownloadCheckpoint,
} from "./actions/downloads";
import {
  CollectionsDownloadCancelledEvent,
  CollectionsDownloadCompletedEvent,
  CollectionsDownloadFailedEvent,
  ModsDownloadCancelledEvent,
  ModsDownloadCompletedEvent,
  ModsDownloadFailedEvent,
  ModsDownloadStartedClientEvent,
} from "./extensions/analytics/mixpanel/MixpanelEvents";
import {
  downloadProgress,
  finishDownload,
  initDownload,
  pauseDownload,
  removeDownload,
  setDownloadFilePath,
  setDownloadHash,
  setDownloadInterrupted,
  setDownloadModInfo,
  setDownloadPausable,
  setDownloadSpeed,
} from "./extensions/download_management/actions/state";
import { downloadPathForGame } from "./extensions/download_management/selectors";
import { nexusIdsFromDownloadId } from "./extensions/nexus_integration/selectors";
import { makeModAndFileUIDs } from "./extensions/nexus_integration/util/UIDs";
import { activeGameId } from "./extensions/profile_management/selectors";
import { log } from "./logging";
import { batchDispatch, flatten } from "./util/util";

function rehydrateDownloadError(state: WireDownloadState): Error | null {
  if (state.status === "canceled") return new UserCanceled();
  if (state.status !== "failed" || state.error === null) return null;
  const { payload, message } = state.error;
  switch (payload.code) {
    case "is-html":
      return new DownloadIsHTML(payload.url);
    case "network-bad-status":
      return new HTTPError(payload.statusCode, message, payload.url);
    default:
      return new DownloadError(
        "url" in payload
          ? { ...payload, url: new URL(payload.url) }
          : { ...payload },
        message,
      );
  }
}

type ProtocolHandler = (
  inputUrl: string,
) => PromiseLike<{ urls: string[]; updatedUrl?: string; meta: unknown }>;

/**
 * The legacy download API encodes an optional Referer header directly into the
 * URL string using `<` as a separator: `"https://cdn.example.com/file<https://referer.example.com"`.
 */
type EncodedUrl = {
  url: URL;
  referer?: string;
};

function parseEncodedUrl(raw: string): EncodedUrl {
  const [rawUrl, referer] = raw.split("<");
  return { url: new URL(rawUrl), referer };
}

type StoredDownloadInfo = {
  encodedUrl: EncodedUrl;
  callback?: (err: Error | null, id?: string) => void;
};

type ActiveDownload = {
  callback?: (err: Error | null, id?: string) => void;
  fileNameHint?: string;
  allowInstall?: boolean;
  lastBytesReceived: number;
  lastProgressDispatch: number;
  startedEventEmitted: boolean;
};

export class IPCDownloadAdapter {
  readonly #api: IExtensionApi;
  readonly #handlers: Record<string, ProtocolHandler> = {};

  readonly #pending = new Map<number, StoredDownloadInfo>();
  // Captures `meta` from the protocol handler in #resolve so it can be merged
  // into download.modInfo once the downloadId is known. The nxm resolver returns
  // nexus IDs (modId/fileId or collectionId/revisionId) here.
  readonly #resolvedMeta = new Map<number, unknown>();
  readonly #activeDownloads = new Map<string, ActiveDownload>();
  #speedAccumBytes = 0;
  #lastSpeedDispatch: number | null = null;
  #nextCollationId = 0;

  constructor(api: IExtensionApi) {
    this.#api = api;

    const pollingInterval = 200;
    this.#pollLoop(pollingInterval).catch(() => {
      /* ignored */
    });

    window.api.downloader.onResolve((collationId) =>
      this.#resolve(collationId),
    );

    api.events.on("start-download", (...args: unknown[]) => {
      const parsed = startDownloadArgsSchema.safeParse(args);
      if (!parsed.success) {
        log("warn", "failed to parse 'start-download' args", {
          error: parsed.error,
        });
        return;
      }

      const [urls, modInfo, fileName, callback, redownload, options] =
        parsed.data;

      this.#handleStartDownload(
        urls,
        modInfo,
        fileName,
        callback,
        redownload,
        options,
      ).catch((err) => {
        log("error", "failed to start download", err);
      });
    });

    api.events.on("remove-download", (...args: unknown[]) => {
      const parsed = removeDownloadArgsSchema.safeParse(args);
      if (!parsed.success) {
        log("warn", "failed to parse 'remove-download' args", {
          error: parsed.error,
        });
        return;
      }

      const [downloadId, callback] = parsed.data;
      this.#handleRemoveDownload(downloadId, callback).catch((err) => {
        log("error", "failed to remove download", err);
      });
    });

    api.events.on("pause-download", (...args: unknown[]) => {
      const parsed = pauseDownloadArgsSchema.safeParse(args);
      if (!parsed.success) {
        log("warn", "failed to parse 'pause-download' args", {
          error: parsed.error,
        });
        return;
      }

      const [downloadId, callback] = parsed.data;
      this.#handlePauseDownload(downloadId, callback).catch((err) => {
        log("error", "failed to pause download", err);
      });
    });

    api.events.on("resume-download", (...args: unknown[]) => {
      const parsed = resumeDownloadArgsSchema.safeParse(args);
      if (!parsed.success) {
        log("warn", "failed to parse 'resume-download' args", {
          error: parsed.error,
        });
        return;
      }

      const [downloadId, callback] = parsed.data;
      this.#handleResumeDownload(downloadId, callback).catch((err) => {
        log("error", "failed to resume download", err);
      });
    });
  }

  registerProtocol(scheme: string, handler: ProtocolHandler): void {
    this.#handlers[scheme] = handler;
    log("debug", `registered protocol handler for scheme '${scheme}'`);
  }

  processInterruptedDownloads(): void {
    const state = this.#api.getState();
    const files = state.persistent.downloads.files ?? {};
    const checkpoints = state.persistent.downloads.checkpoints ?? {};

    for (const [id, download] of Object.entries(files)) {
      if (!["init", "started"].includes(download.state)) continue;

      const checkpoint = checkpoints[id];
      if (checkpoint !== undefined) {
        log("debug", "auto-resuming interrupted download", { id });
        this.#activeDownloads.set(id, {
          lastBytesReceived: 0,
          lastProgressDispatch: 0,
          startedEventEmitted: false,
        });
        window.api.downloader.resume(checkpoint).catch((err) => {
          log("error", "failed to auto-resume download", { id, err });
          this.#activeDownloads.delete(id);
          this.#api.store.dispatch(
            setDownloadInterrupted(id, download.received),
          );
        });
      } else {
        log("debug", "interrupted download has no checkpoint, marking paused", {
          id,
        });
        this.#api.store.dispatch(setDownloadInterrupted(id, download.received));
      }
    }
  }

  #emitAnalytics(
    downloadId: string,
    eventType: "started" | "completed" | "failed" | "canceled",
    error?: Error,
  ): void {
    const state = this.#api.getState();
    const nexusIds = nexusIdsFromDownloadId(state, downloadId);
    if (!nexusIds?.numericGameId || isNaN(nexusIds.numericGameId)) return;

    const download = state.persistent.downloads.files?.[downloadId];
    const isCollection =
      nexusIds.collectionSlug !== undefined &&
      nexusIds.revisionId !== undefined;

    if (eventType === "started") {
      if (
        isCollection ||
        nexusIds.modId === undefined ||
        nexusIds.fileId === undefined
      )
        return;
      const { modUID, fileUID } = makeModAndFileUIDs(
        nexusIds.numericGameId.toString(),
        nexusIds.modId,
        nexusIds.fileId,
      );
      this.#api.events.emit(
        "analytics-track-mixpanel-event",
        new ModsDownloadStartedClientEvent(
          nexusIds.modId,
          nexusIds.fileId,
          nexusIds.numericGameId,
          modUID,
          fileUID,
        ),
      );
      return;
    }

    if (eventType === "completed") {
      const duration_ms = Date.now() - (download?.fileTime ?? Date.now());
      const file_size = download?.size ?? 0;
      if (isCollection && nexusIds.collectionId && nexusIds.revisionId) {
        this.#api.events.emit(
          "analytics-track-mixpanel-event",
          new CollectionsDownloadCompletedEvent(
            nexusIds.collectionId,
            nexusIds.revisionId,
            nexusIds.numericGameId,
            file_size,
            duration_ms,
          ),
        );
      } else if (
        nexusIds.modId !== undefined &&
        nexusIds.fileId !== undefined
      ) {
        const { modUID, fileUID } = makeModAndFileUIDs(
          nexusIds.numericGameId.toString(),
          nexusIds.modId,
          nexusIds.fileId,
        );
        this.#api.events.emit(
          "analytics-track-mixpanel-event",
          new ModsDownloadCompletedEvent(
            nexusIds.modId,
            nexusIds.fileId,
            nexusIds.numericGameId,
            modUID,
            fileUID,
            file_size,
            duration_ms,
          ),
        );
      }
      return;
    }

    if (eventType === "canceled") {
      if (isCollection && nexusIds.collectionId && nexusIds.revisionId) {
        this.#api.events.emit(
          "analytics-track-mixpanel-event",
          new CollectionsDownloadCancelledEvent(
            nexusIds.collectionId,
            nexusIds.revisionId,
            nexusIds.numericGameId,
          ),
        );
      } else if (
        nexusIds.modId !== undefined &&
        nexusIds.fileId !== undefined
      ) {
        const { modUID, fileUID } = makeModAndFileUIDs(
          nexusIds.numericGameId.toString(),
          nexusIds.modId,
          nexusIds.fileId,
        );
        this.#api.events.emit(
          "analytics-track-mixpanel-event",
          new ModsDownloadCancelledEvent(
            nexusIds.modId,
            nexusIds.fileId,
            nexusIds.numericGameId,
            modUID,
            fileUID,
          ),
        );
      }
      return;
    }

    if (eventType === "failed") {
      const message = error?.message ?? "";
      if (isCollection && nexusIds.collectionId && nexusIds.revisionId) {
        this.#api.events.emit(
          "analytics-track-mixpanel-event",
          new CollectionsDownloadFailedEvent(
            nexusIds.collectionId,
            nexusIds.revisionId,
            nexusIds.numericGameId,
            "",
            message,
          ),
        );
      } else if (
        nexusIds.modId !== undefined &&
        nexusIds.fileId !== undefined
      ) {
        const { modUID, fileUID } = makeModAndFileUIDs(
          nexusIds.numericGameId.toString(),
          nexusIds.modId,
          nexusIds.fileId,
        );
        this.#api.events.emit(
          "analytics-track-mixpanel-event",
          new ModsDownloadFailedEvent(
            nexusIds.modId,
            nexusIds.fileId,
            nexusIds.numericGameId,
            modUID,
            fileUID,
            "",
            message,
          ),
        );
      }
    }
  }

  async #completeDownload(
    downloadId: string,
    wireState: WireDownloadState,
    activeDownload?: ActiveDownload,
  ): Promise<void> {
    const reduxState = this.#api.getState();
    const download = reduxState.persistent.downloads.files?.[downloadId];

    if (download?.localPath !== undefined) {
      const gameId = download.game?.[0] ?? activeGameId(reduxState);
      const dlPath = downloadPathForGame(reduxState, gameId);
      const tempPath = path.join(dlPath, download.localPath);

      // Determine the final filename: server Content-Disposition > caller hint > temp name.
      const hint = activeDownload?.fileNameHint;
      const finalName = wireState.fileName ?? hint ?? download.localPath;
      const finalPath = path.join(dlPath, finalName);

      if (finalPath !== tempPath) {
        try {
          await rename(tempPath, finalPath);
          this.#api.store.dispatch(setDownloadFilePath(downloadId, finalName));
        } catch (err) {
          log("warn", "failed to rename download to final name", {
            downloadId,
            tempPath,
            finalPath,
            err,
          });
        }
      }

      try {
        // TODO: move hashing into main process

        // MD5 is used as a fallback identifier for collection rule matching and
        // reverse ModDB lookups for files that lack Nexus IDs (e.g. non-NXM downloads).
        const hash = createHash("md5");
        await pipeline(createReadStream(finalPath), hash);
        this.#api.store.dispatch(
          setDownloadHash(downloadId, hash.digest("hex")),
        );
      } catch (err) {
        log("warn", "failed to compute MD5 for download", { downloadId, err });
      }
    }

    // Mark record as finished. nexus_integration reads finished records
    // for attribute extraction during mod installation.
    this.#api.store.dispatch(finishDownload(downloadId, "finished", null));
    // Notify listeners that the download completed. InstallManager listens
    // for this to trigger auto-install when automation is enabled.
    this.#api.events.emit("did-finish-download", downloadId, "finished");
    // Fire the start-download callback now that the file is on disk. Callers
    // (e.g. nexus_integration collection download) rely on the callback firing
    // after completion to trigger installation, matching DownloadObserver behaviour.
    activeDownload?.callback?.(null, downloadId);

    const allowInstall = activeDownload?.allowInstall;

    const autoInstall =
      reduxState.settings.automation?.install ||
      download?.modInfo?.["startedAsUpdate"] === true;

    // Trigger auto-install respecting the per-download allowInstall override.
    // "force" (stored as true) → always install; false → never; undefined → automation setting.
    const shouldInstall =
      allowInstall || (allowInstall !== false && autoInstall);
    if (shouldInstall) {
      this.#api.events.emit("start-install-download", downloadId);
    }
  }

  async #handleStartDownload(
    rawUrls: string[],
    modInfo: ModInfo,
    fileName?: string,
    callback?: (err: Error | null, id?: string) => void,
    redownload?: "never" | "ask" | "replace" | "always",
    options?: { allowInstall?: boolean | "force" },
  ): Promise<void> {
    // TODO: decide how to handle multiple URL inputs
    const rawUrl = rawUrls[0];

    const encodedUrl = parseEncodedUrl(rawUrl.toString());

    const state = this.#api.getState();
    const dlPath = downloadPathForGame(
      state,
      modInfo.game ?? activeGameId(state),
    );

    // Check for an existing file using the caller-supplied name before queuing.
    // We can only do this when a name is provided; temp-named downloads are always new.
    if (fileName !== undefined && redownload !== "always") {
      const namedDest = path.join(dlPath, fileName);
      const fileExists = await access(namedDest).then(
        () => true,
        () => false,
      );
      if (fileExists && redownload !== "replace") {
        if (redownload === "ask") {
          const result = await this.#api.showDialog?.(
            "question",
            "File already downloaded",
            { text: `"${fileName}" is already on disk. Download again?` },
            [{ label: "Use existing" }, { label: "Re-download" }],
          );

          if (result?.action !== "Re-download") {
            const downloads = state.persistent.downloads.files;
            const [existingId, _] = Object.entries(downloads).find(
              ([_, download]) => download.localPath === fileName,
            );

            callback?.(new AlreadyDownloaded(fileName, existingId));
            return;
          }
        } else {
          const downloads = state.persistent.downloads.files;
          const [existingId, _] = Object.entries(downloads).find(
            ([_, download]) => download.localPath === fileName,
          );

          callback?.(new AlreadyDownloaded(fileName, existingId));
          return;
        }
      }
    }

    const collationId = this.#nextCollationId++;
    try {
      const info: StoredDownloadInfo = {
        encodedUrl: encodedUrl,
        callback,
      };

      this.#pending.set(collationId, info);

      // Use a temporary filename so the main process can start writing immediately.
      // #completeDownload renames to the final name derived from Content-Disposition.
      // The real filename is passed as a hint; the server name takes priority.
      const collationStr = collationId.toString().padStart(8, "0");
      const tempName = `__vortex_tmp_${collationStr}`;
      const dest = path.join(dlPath, tempName);

      log("debug", "starting download", {
        encodedUrl,
        dest,
        collationId,
      });

      const { downloadId } = await window.api.downloader.start(
        dest,
        collationId,
      );

      const allowInstall =
        options?.allowInstall === false
          ? false
          : options?.allowInstall === "force"
            ? true
            : undefined;

      this.#activeDownloads.set(downloadId, {
        callback,
        fileNameHint: fileName,
        allowInstall,
        lastBytesReceived: 0,
        lastProgressDispatch: 0,
        startedEventEmitted: false,
      });
      log("debug", "download queued", { downloadId, collationId });

      const gameId = modInfo.game ?? activeGameId(state);
      // Create the Redux record. nexus_integration's onChangeDownloads watches
      // downloads.files and triggers metadata enrichment when nexus.ids is present.
      this.#api.store.dispatch(
        initDownload(downloadId, rawUrls, modInfo, [gameId]),
      );
      // Set localPath to the temp name so the UI has something to display.
      this.#api.store.dispatch(setDownloadFilePath(downloadId, tempName));
      // All IPC downloads support pause via checkpoint. DownloadView checks
      // download.pausable to show/hide the pause button.
      this.#api.store.dispatch(setDownloadPausable(downloadId, true));

      // Flatten the resolver's meta into download.modInfo. For nxm URLs this
      // carries nexus.ids.modId/fileId (or collectionId/revisionId), which
      // attributeExtractors and collection install plumbing read from.
      const resolvedMeta = this.#resolvedMeta.get(collationId);
      this.#resolvedMeta.delete(collationId);

      if (resolvedMeta !== undefined) {
        const flattened = flatten(resolvedMeta) as Record<string, unknown>;
        const actions = Object.entries(flattened).map(([key, value]) =>
          setDownloadModInfo(downloadId, key, value),
        );
        if (actions.length > 0) {
          batchDispatch(this.#api.store, actions);
        }
      }
    } catch (err) {
      this.#resolvedMeta.delete(collationId);
      callback?.(unknownToError(err));
    }
  }

  async #handleRemoveDownload(
    downloadId: string,
    callback?: (err: Error | null) => void,
  ): Promise<void> {
    try {
      if (this.#activeDownloads.has(downloadId)) {
        log("debug", "cancelling download", { downloadId });
        await window.api.downloader.cancel(downloadId);
      } else {
        const state = this.#api.getState();
        const download = state.persistent.downloads.files?.[downloadId];
        if (download?.localPath) {
          const gameId = download.game?.[0] ?? activeGameId(state);
          const dlPath = downloadPathForGame(state, gameId);
          await rm(path.join(dlPath, download.localPath), { force: true });
        }
        // Remove record from Redux to clear it from the downloads list.
        this.#api.store.dispatch(removeDownload(downloadId));
      }
      callback?.(null);
    } catch (err) {
      callback?.(unknownToError(err));
    }
  }

  async #handlePauseDownload(
    downloadId: string,
    callback?: (err: Error | null) => void,
  ): Promise<void> {
    try {
      log("debug", "pausing download", { downloadId });
      const checkpoint = await window.api.downloader.pause(downloadId);
      this.#api.store.dispatch(setDownloadCheckpoint(downloadId, checkpoint));
      this.#api.store.dispatch(pauseDownload(downloadId, true));
      callback?.(null);
    } catch (err) {
      callback?.(unknownToError(err));
    }
  }

  async #handleResumeDownload(
    downloadId: string,
    callback?: (err: Error | null, id?: string) => void,
  ): Promise<void> {
    try {
      const checkpoint =
        this.#api.getState().persistent.downloads.checkpoints[downloadId];
      if (checkpoint === undefined) {
        throw new Error(`No checkpoint stored for download ${downloadId}`);
      }

      log("debug", "resuming download", { downloadId });
      await window.api.downloader.resume(checkpoint);
      callback?.(null, downloadId);
    } catch (err) {
      callback?.(unknownToError(err));
    }
  }

  async #pollLoop(interval: number): Promise<void> {
    for (;;) {
      try {
        await new Promise<void>((r) => setTimeout(r, interval));
        await this.#poll();
      } catch {
        // ignored
      }
    }
  }

  async #poll(): Promise<void> {
    const downloadIds = this.#activeDownloads.keys().toArray();
    if (downloadIds.length === 0) return;

    const states = await window.api.downloader.getStates(downloadIds);
    const now = Date.now();

    let totalDeltaBytes = 0;
    for (const [downloadId, state] of Object.entries(states)) {
      const activeDownload = this.#activeDownloads.get(downloadId);
      if (activeDownload === undefined) continue;

      const delta = Math.max(
        0,
        state.bytesReceived - activeDownload.lastBytesReceived,
      );
      totalDeltaBytes += delta;
      activeDownload.lastBytesReceived = state.bytesReceived;

      const isTerminal =
        state.status === "completed" ||
        state.status === "failed" ||
        state.status === "canceled";

      if (delta > 0 && !activeDownload.startedEventEmitted) {
        const reduxDownload =
          this.#api.getState().persistent.downloads.files?.[downloadId];
        if ((reduxDownload?.received ?? 0) === 0) {
          this.#emitAnalytics(downloadId, "started");
        }
        activeDownload.startedEventEmitted = true;
      }

      const secSinceProgress =
        (now - activeDownload.lastProgressDispatch) / 1000;
      if (delta > 0 && (secSinceProgress >= 1 || isTerminal)) {
        activeDownload.lastProgressDispatch = now;
        // Update received/total bytes. The reducer transitions state from
        // "init" to "started" on first non-zero received, driving the progress bar.
        this.#api.store.dispatch(
          downloadProgress(
            downloadId,
            state.bytesReceived,
            state.size ?? 0,
            [],
          ),
        );
      }

      if (!isTerminal) continue;

      const err = rehydrateDownloadError(state);
      if (err !== null)
        log("warn", "download ended with error", { downloadId, err });
      this.#activeDownloads.delete(downloadId);
      this.#api.store.dispatch(clearDownloadCheckpoint(downloadId));

      if (state.status === "completed") {
        this.#emitAnalytics(downloadId, "completed");
        this.#completeDownload(downloadId, state, activeDownload).catch(
          (err) => {
            log("error", "failed to finalize download", { downloadId, err });
          },
        );
      } else if (state.status === "canceled") {
        this.#emitAnalytics(downloadId, "canceled");
        // User canceled - remove the record entirely, no file to keep.
        this.#api.store.dispatch(removeDownload(downloadId));
        activeDownload.callback?.(new UserCanceled(), downloadId);
      } else {
        this.#emitAnalytics(downloadId, "failed", err ?? undefined);
        // Mark record as failed so the UI can show an error state.
        this.#api.store.dispatch(finishDownload(downloadId, "failed", err));
        this.#api.events.emit("did-finish-download", downloadId, "failed");
        activeDownload.callback?.(
          err ?? new Error("download failed"),
          downloadId,
        );
      }
    }

    this.#speedAccumBytes += totalDeltaBytes;

    if (totalDeltaBytes > 0 && this.#lastSpeedDispatch === null) {
      this.#lastSpeedDispatch = now;
    }

    if (this.#lastSpeedDispatch !== null) {
      const secSinceDispatch = (now - this.#lastSpeedDispatch) / 1000;
      if (secSinceDispatch >= 1 || this.#activeDownloads.size === 0) {
        const speed =
          secSinceDispatch > 0 ? this.#speedAccumBytes / secSinceDispatch : 0;
        this.#speedAccumBytes = 0;
        this.#lastSpeedDispatch = this.#activeDownloads.size > 0 ? now : null;
        if (speed > 0 || this.#activeDownloads.size === 0) {
          // Update speed display and speedHistory for the download graph.
          // Aggregated over 1s to avoid thrashing Redux with every poll tick.
          this.#api.store.dispatch(setDownloadSpeed(Math.round(speed)));
        }
      }
    }
  }

  async #resolve(collationId: number): Promise<WireResolvedResource> {
    const info = this.#pending.get(collationId);
    if (info === undefined) {
      throw new Error(`No pending download for collationId ${collationId}`);
    }

    this.#pending.delete(collationId);

    const { encodedUrl } = info;
    const headers: Record<string, string> | undefined = encodedUrl.referer
      ? { Referer: encodedUrl.referer }
      : undefined;

    const scheme = encodedUrl.url.protocol.replace(/:$/, "");
    const handler = this.#handlers[scheme];

    if (handler !== undefined) {
      log("debug", "resolving download via protocol handler", {
        scheme,
        encodedUrl,
      });

      const resolved = await Promise.resolve(
        handler(encodedUrl.url.toString()),
      );

      // Stash resolver meta so #handleStartDownload can merge it into modInfo.
      if (resolved.meta !== undefined && resolved.meta !== null) {
        this.#resolvedMeta.set(collationId, resolved.meta);
      }

      log("debug", "download resolved", { resolvedUrl: resolved.urls[0] });
      return { probeEndpoint: { url: resolved.urls[0] } };
    }

    if (scheme === "http" || scheme === "https") {
      log("debug", "resolving download directly", { encodedUrl });
      return { probeEndpoint: { url: encodedUrl.url.toString(), headers } };
    }

    throw new Error(`No protocol handler registered for scheme: ${scheme}`);
  }
}

const modInfoSchema = z
  .looseObject({
    game: z.string().optional(),
    name: z.string().optional(),
  })
  .catch({ game: undefined, name: undefined });

type ModInfo = z.infer<typeof modInfoSchema>;

const urlStringSchema = z.union([
  z.string(),
  z.custom<URL>((v) => v instanceof URL).transform((v) => v.toString()),
]);

const startDownloadArgsSchema = z
  .tuple([
    z.array(urlStringSchema),
    modInfoSchema,
    z.string().optional(),
    z
      .function({ input: [z.unknown().nullable(), z.string().optional()] })
      .optional(),
    z.enum(["never", "ask", "replace", "always"]).optional(),
    z
      .object({
        allowInstall: z.union([z.boolean(), z.literal("force")]).optional(),
      })
      .optional(),
  ])
  .rest(z.unknown());

const removeDownloadArgsSchema = z
  .tuple([
    z.string(),
    z
      .function({
        input: [z.unknown().nullable()],
      })
      .optional(),
  ])
  .rest(z.unknown());

const pauseDownloadArgsSchema = z
  .tuple([
    z.string(),
    z.function({ input: [z.unknown().nullable()] }).optional(),
  ])
  .rest(z.unknown());

const resumeDownloadArgsSchema = z
  .tuple([
    z.string(),
    z
      .function({ input: [z.unknown().nullable(), z.string().optional()] })
      .optional(),
  ])
  .rest(z.unknown());
