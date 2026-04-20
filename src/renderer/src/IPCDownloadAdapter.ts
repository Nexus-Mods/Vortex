import type {
  WireDownloadCheckpoint,
  WireResolvedResource,
} from "@vortex/shared/ipc";

import { unknownToError } from "@vortex/shared";
import * as path from "node:path";
import { z } from "zod";

import type { IExtensionApi } from "./types/IExtensionContext";

import { downloadPathForGame } from "./extensions/download_management/selectors";
import { activeGameId } from "./extensions/profile_management/selectors";
import { log } from "./logging";

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

export class IPCDownloadAdapter {
  readonly #api: IExtensionApi;
  readonly #handlers: Record<string, ProtocolHandler> = {};

  readonly #pending = new Map<number, StoredDownloadInfo>();
  readonly #infoByDownloadId = new Map<string, StoredDownloadInfo>();
  readonly #checkpointByDownloadId = new Map<string, WireDownloadCheckpoint>();
  #nextCollationId = 0;

  constructor(api: IExtensionApi) {
    // TODO: remove after cut-off to fully switch implementation
    if (process.env.VORTEX_USE_IPC_DOWNLOADER !== "1") return;

    this.#api = api;

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

      this.#infoByDownloadId.set(downloadId, info);
      log("debug", "download queued", { downloadId, collationId });
      callback?.(null, downloadId);
    } catch (err) {
      callback?.(unknownToError(err));
    }
  }

  async #handleRemoveDownload(
    downloadId: string,
    callback?: (err: Error | null) => void,
  ): Promise<void> {
    try {
      log("debug", "cancelling download", { downloadId });
      await window.api.downloader.cancel(downloadId);
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
      this.#checkpointByDownloadId.set(downloadId, checkpoint);
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
      const checkpoint = this.#checkpointByDownloadId.get(downloadId);
      if (checkpoint === undefined) {
        throw new Error(`No checkpoint stored for download ${downloadId}`);
      }

      const info = this.#infoByDownloadId.get(downloadId);
      if (info === undefined) {
        throw new Error(`No stored info for download ${downloadId}`);
      }

      const collationId = this.#nextCollationId++;
      this.#pending.set(collationId, info);

      log("debug", "resuming download", { downloadId, collationId });
      await window.api.downloader.resume(checkpoint, collationId);
      callback?.(null, downloadId);
    } catch (err) {
      callback?.(unknownToError(err));
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
