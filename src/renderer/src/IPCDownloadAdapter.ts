import type { WireResolvedResource } from "@vortex/shared/ipc";

import { unknownToError } from "@vortex/shared";
import * as path from "node:path";
import { z } from "zod";

import type { IProtocolHandlers } from "./extensions/download_management/types/ProtocolHandlers";
import type { IExtensionApi } from "./types/IExtensionContext";

import { downloadPathForGame } from "./extensions/download_management/selectors";
import { activeGameId } from "./extensions/profile_management/selectors";
import { log } from "./logging";

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

type StoredDownloadInfo = {
  url: string;
  name: string;
  friendlyName: string;
};

export class IPCDownloadAdapter {
  readonly #api: IExtensionApi;
  readonly #handlers: IProtocolHandlers;

  readonly #pending = new Map<number, StoredDownloadInfo>();

  constructor(api: IExtensionApi, handlers: IProtocolHandlers) {
    this.#api = api;
    this.#handlers = handlers;

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
  }

  async start(
    url: string,
    dest: string,
    name: string = "",
    friendlyName: string = "",
  ): Promise<string> {
    const { downloadId, collationId } = await window.api.downloader.start(dest);
    this.#pending.set(collationId, { url, name, friendlyName });
    return downloadId;
  }

  cancel(downloadId: string): Promise<void> {
    return window.api.downloader.cancel(downloadId);
  }

  async #handleStartDownload(
    urls: string[],
    modInfo: ModInfo,
    fileName?: string,
    callback?: (err: Error | null, id?: string) => void,
  ): Promise<void> {
    const url = urls[0].toString().split("<")[0];
    const state = this.#api.getState();
    const dest = downloadPathForGame(
      state,
      modInfo.game ?? activeGameId(state),
    );

    let name: string;
    try {
      name = fileName || path.basename(new URL(url).pathname);
    } catch {
      name = fileName ?? "";
    }

    try {
      const downloadId = await this.start(url, dest, name, modInfo.name ?? "");
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
      await this.cancel(downloadId);
      callback?.(null);
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

    const { url, name, friendlyName } = info;
    const scheme = new URL(url).protocol.replace(/:$/, "");
    const handler = this.#handlers[scheme];

    if (handler !== undefined) {
      const resolved = await Promise.resolve(handler(url, name, friendlyName));
      return { probeEndpoint: { url: resolved.urls[0] } };
    }

    if (scheme === "http" || scheme === "https") {
      return { probeEndpoint: { url } };
    }

    throw new Error(`No protocol handler registered for scheme: ${scheme}`);
  }
}
