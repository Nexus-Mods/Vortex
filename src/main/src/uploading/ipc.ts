import { betterIpcMain } from "../ipc";
import type { UploadManager } from "./manager";

export function init(manager: UploadManager): void {
  betterIpcMain.handle("upload:file", (_event, request) => manager.upload(request));

  betterIpcMain.handle("upload:s3-multipart", (_event, request) =>
    manager.uploadMultipart(request),
  );

  betterIpcMain.handle("upload:getProgress", (_event, uploadId) => {
    return manager.getProgress(uploadId) ?? null;
  });

  betterIpcMain.handle("upload:cancel", (_event, uploadId) => {
    manager.cancel(uploadId);
  });
}
