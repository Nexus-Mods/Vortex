import type {
  ResolvedEndpoint,
  ResolvedResource,
} from "@vortex/shared/download";
import type {
  WireDownloadCheckpoint,
  WireEndpoint,
  WireResolvedResource,
} from "@vortex/shared/ipc";
import type { WebContents } from "electron";

import { staticChunker } from "@vortex/shared/download";

import type { DownloadManager } from "./manager";

import { betterIpcMain } from "../ipc";

function wireToResolvedEndpoint(wire: WireEndpoint): ResolvedEndpoint {
  return { url: new URL(wire.url), headers: wire.headers };
}

function wireToResolvedResource(wire: WireResolvedResource): ResolvedResource {
  const probe = wireToResolvedEndpoint(wire.probeEndpoint);
  if (!wire.chunkEndpoints?.length) return probe;
  return {
    probeEndpoint: probe,
    chunkEndpoint: (chunk) =>
      Promise.resolve(
        wireToResolvedEndpoint(
          wire.chunkEndpoints[chunk.index] ?? wire.probeEndpoint,
        ),
      ),
  };
}

export function init(manager: DownloadManager): void {
  const timeout = 30_000;

  const webContentsByDownloadId = new Map<string, WebContents>();

  betterIpcMain.handle("download:start", async (event, dest, collationId) => {
    const webContents = event.sender;
    const wireResource = await betterIpcMain.callback(
      "download:resolve",
      webContents,
      timeout,
      collationId,
    );
    const resource = wireToResolvedResource(wireResource);
    const resolver = () => Promise.resolve(resource);
    const handle = manager.download(resource, dest, resolver);
    webContentsByDownloadId.set(handle.downloadId, webContents);
    return { downloadId: handle.downloadId };
  });

  betterIpcMain.handle("download:cancel", (_event, downloadId) => {
    manager.cancel(downloadId);
  });

  betterIpcMain.handle("download:pause", async (_event, downloadId) => {
    const result = await manager.pause(downloadId);
    if (result.status !== "paused") {
      throw new Error(
        `Download ${downloadId} is not paused: status is ${result.status}`,
      );
    }
    const { checkpoint } = result;
    const wire: WireDownloadCheckpoint = {
      downloadId: checkpoint.downloadId,
      dest: checkpoint.dest,
      completedRanges: checkpoint.completedRanges,
      etag: checkpoint.etag,
    };
    return wire;
  });

  betterIpcMain.handle(
    "download:resume",
    async (event, wireCheckpoint, collationId) => {
      const webContents = event.sender;
      const wireResource = await betterIpcMain.callback(
        "download:resolve",
        webContents,
        timeout,
        collationId,
      );
      const resource = wireToResolvedResource(wireResource);
      const checkpoint = {
        downloadId: wireCheckpoint.downloadId,
        resource,
        dest: wireCheckpoint.dest,
        completedRanges: wireCheckpoint.completedRanges,
        etag: wireCheckpoint.etag,
      };
      const resolver = () => Promise.resolve(resource);
      manager.resume(checkpoint, resolver, staticChunker());
      webContentsByDownloadId.set(wireCheckpoint.downloadId, webContents);
    },
  );

  betterIpcMain.handle("download:getProgress", (_event, downloadId) => {
    const handle = manager.get(downloadId);
    if (handle === undefined)
      throw new Error(`Unknown download: ${downloadId}`);
    return handle.getProgress();
  });
}
