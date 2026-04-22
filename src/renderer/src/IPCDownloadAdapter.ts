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
import { access, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import * as path from "node:path";
import { z } from "zod";

import type { IExtensionApi } from "./types/IExtensionContext";

import {
  clearDownloadCheckpoint,
  setDownloadCheckpoint,
} from "./actions/downloads";
import {
  downloadProgress,
  finishDownload,
  initDownload,
  pauseDownload,
  removeDownload,
  setDownloadFilePath,
  setDownloadHash,
  setDownloadInterrupted,
  setDownloadPausable,
  setDownloadSpeed,
} from "./extensions/download_management/actions/state";
import { downloadPathForGame } from "./extensions/download_management/selectors";
import { activeGameId } from "./extensions/profile_management/selectors";
import { log } from "./logging";

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
};

type DownloadState = {
  encodedUrl: EncodedUrl;
};

export class IPCDownloadAdapter {
  readonly #api: IExtensionApi;
  readonly #handlers: Record<string, ProtocolHandler> = {};

  // TODO: APP-353, APP-228 once the URL and checkpoint are both written to Redux,
  // #downloadState can be removed entirely and both resume paths read from Redux instead.
  readonly #pending = new Map<number, StoredDownloadInfo>();
  readonly #downloadState = new Map<string, DownloadState>();
  readonly #lastBytesReceived = new Map<string, number>();
  readonly #lastProgressDispatch = new Map<string, number>();
  #speedAccumBytes = 0;
  #lastSpeedDispatch: number | null = null;
  #nextCollationId = 0;

  constructor(api: IExtensionApi) {
    // TODO: remove after cut-off to fully switch implementation
    if (process.env.VORTEX_USE_IPC_DOWNLOADER !== "1") return;

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

      const [urls, modInfo, fileName, callback] = parsed.data;

      this.#handleStartDownload(urls, modInfo, fileName, callback).catch(
        (err) => {
          log("error", "failed to start download", err);
        },
      );
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
    if (process.env.VORTEX_USE_IPC_DOWNLOADER !== "1") return;

    const state = this.#api.getState();
    const files = state.persistent.downloads.files ?? {};
    const checkpoints = state.persistent.downloads.checkpoints ?? {};

    for (const [id, download] of Object.entries(files)) {
      if (!["init", "started"].includes(download.state)) continue;

      const checkpoint = checkpoints[id];
      if (checkpoint !== undefined) {
        log("debug", "auto-resuming interrupted download", { id });
        this.#downloadState.set(id, {
          encodedUrl: parseEncodedUrl(checkpoint.resource),
        });
        window.api.downloader.resume(checkpoint).catch((err) => {
          log("error", "failed to auto-resume download", { id, err });
          this.#downloadState.delete(id);
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

  async #completeDownload(downloadId: string): Promise<void> {
    const reduxState = this.#api.getState();
    const download = reduxState.persistent.downloads.files?.[downloadId];

    if (download?.localPath !== undefined) {
      const gameId = download.game?.[0] ?? activeGameId(reduxState);
      const dlPath = downloadPathForGame(reduxState, gameId);
      const filePath = path.join(dlPath, download.localPath);
      try {
        // TODO: move hashing into main process

        // MD5 is used as a fallback identifier for collection rule matching and
        // reverse ModDB lookups for files that lack Nexus IDs (e.g. non-NXM downloads).
        const hash = createHash("md5");
        await pipeline(createReadStream(filePath), hash);
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

    // Trigger auto-install if the user has automation enabled or if this
    // download was started as an update (e.g. from the mod management view).
    if (
      reduxState.settings.automation?.install ||
      download?.modInfo?.["startedAsUpdate"] === true
    ) {
      this.#api.events.emit("start-install-download", downloadId);
    }
  }

  async #handleStartDownload(
    rawUrls: string[],
    modInfo: ModInfo,
    fileName?: string,
    callback?: (err: Error | null, id?: string) => void,
  ): Promise<void> {
    // TODO: decide how to handle multiple URL inputs
    const rawUrl = rawUrls[0];

    const encodedUrl = parseEncodedUrl(rawUrl.toString());

    try {
      fileName ??= path.basename(encodedUrl.url.pathname);
    } catch {
      fileName ??= "";
    }

    const state = this.#api.getState();
    const dest = path.join(
      downloadPathForGame(state, modInfo.game ?? activeGameId(state)),
      fileName,
    );

    const fileExists = await access(dest).then(
      () => true,
      () => false,
    );
    if (fileExists) {
      const err = new AlreadyDownloaded(path.basename(dest));
      callback?.(err);
      return;
    }

    try {
      const collationId = this.#nextCollationId++;
      const info: StoredDownloadInfo = {
        encodedUrl: encodedUrl,
      };

      this.#pending.set(collationId, info);
      log("debug", "starting download", {
        encodedUrl,
        dest,
        fileName,
        collationId,
      });

      const { downloadId } = await window.api.downloader.start(
        dest,
        collationId,
      );

      this.#downloadState.set(downloadId, { encodedUrl: info.encodedUrl });
      log("debug", "download queued", { downloadId, collationId });
      callback?.(null, downloadId);

      const gameId = modInfo.game ?? activeGameId(state);
      // Create the Redux record. nexus_integration's onChangeDownloads watches
      // downloads.files and triggers metadata enrichment when nexus.ids is present.
      this.#api.store.dispatch(
        initDownload(downloadId, rawUrls, modInfo, [gameId]),
      );
      // Set localPath immediately so the directory watcher can match the file on
      // disk and skip creating a duplicate addLocalDownload record for the same file.
      this.#api.store.dispatch(setDownloadFilePath(downloadId, fileName));
      // All IPC downloads support pause via checkpoint. DownloadView checks
      // download.pausable to show/hide the pause button.
      this.#api.store.dispatch(setDownloadPausable(downloadId, true));
    } catch (err) {
      callback?.(unknownToError(err));
    }
  }

  async #handleRemoveDownload(
    downloadId: string,
    callback?: (err: Error | null) => void,
  ): Promise<void> {
    try {
      if (this.#downloadState.has(downloadId)) {
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
      this.#api.store.dispatch(pauseDownload(downloadId, true, []));
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
    const downloadIds = this.#downloadState.keys().toArray();
    if (downloadIds.length === 0) return;

    const states = await window.api.downloader.getStates(downloadIds);
    const now = Date.now();

    let totalDeltaBytes = 0;
    for (const [downloadId, state] of Object.entries(states)) {
      const prev = this.#lastBytesReceived.get(downloadId) ?? 0;
      const delta = Math.max(0, state.bytesReceived - prev);
      totalDeltaBytes += delta;
      this.#lastBytesReceived.set(downloadId, state.bytesReceived);

      const isTerminal =
        state.status === "completed" ||
        state.status === "failed" ||
        state.status === "canceled";

      const secSinceProgress =
        (now - (this.#lastProgressDispatch.get(downloadId) ?? 0)) / 1000;
      if (delta > 0 && (secSinceProgress >= 1 || isTerminal)) {
        this.#lastProgressDispatch.set(downloadId, now);
        // Update received/total bytes. The reducer transitions state from
        // "init" to "started" on first non-zero received, driving the progress bar.
        this.#api.store.dispatch(
          downloadProgress(
            downloadId,
            state.bytesReceived,
            state.size ?? 0,
            [],
            [],
          ),
        );
      }

      if (!isTerminal) continue;

      const err = rehydrateDownloadError(state);
      if (err !== null)
        log("warn", "download ended with error", { downloadId, err });
      this.#downloadState.delete(downloadId);
      this.#lastBytesReceived.delete(downloadId);
      this.#lastProgressDispatch.delete(downloadId);
      this.#api.store.dispatch(clearDownloadCheckpoint(downloadId));

      if (state.status === "completed") {
        this.#completeDownload(downloadId).catch((err) => {
          log("error", "failed to finalize download", { downloadId, err });
        });
      } else if (state.status === "canceled") {
        // User canceled - remove the record entirely, no file to keep.
        this.#api.store.dispatch(removeDownload(downloadId));
      } else {
        // Mark record as failed so the UI can show an error state.
        this.#api.store.dispatch(finishDownload(downloadId, "failed", err));
        this.#api.events.emit("did-finish-download", downloadId, "failed");
      }
    }

    this.#speedAccumBytes += totalDeltaBytes;

    if (totalDeltaBytes > 0 && this.#lastSpeedDispatch === null) {
      this.#lastSpeedDispatch = now;
    }

    if (this.#lastSpeedDispatch !== null) {
      const secSinceDispatch = (now - this.#lastSpeedDispatch) / 1000;
      if (secSinceDispatch >= 1 || this.#downloadState.size === 0) {
        const speed =
          secSinceDispatch > 0 ? this.#speedAccumBytes / secSinceDispatch : 0;
        this.#speedAccumBytes = 0;
        this.#lastSpeedDispatch = this.#downloadState.size > 0 ? now : null;
        if (speed > 0 || this.#downloadState.size === 0) {
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

const startDownloadArgsSchema = z
  .tuple([
    z.array(z.string()),
    modInfoSchema,
    z.string().optional(),
    z
      .function({ input: [z.unknown().nullable(), z.string().optional()] })
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
