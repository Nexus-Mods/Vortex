import { app } from "electron";

import { betterIpcMain } from "../ipc";
import { createProgressSender } from "./progress";
import { uploadS3Multipart } from "./s3Multipart";
import { uploadFile } from "./transport";

export function init(): void {
  const userAgent = `Vortex/${app.getVersion()}`;

  betterIpcMain.handle("upload:file", (event, request) => {
    const { url, filePath, fileSize, uploadId, headers } = request;
    return uploadFile(url, filePath, fileSize, {
      userAgent,
      headers,
      onProgress: createProgressSender(event.sender, uploadId, fileSize),
    });
  });

  betterIpcMain.handle("upload:s3-multipart", (event, request) => {
    const { layout, filePath, fileSize, uploadId, headers } = request;
    return uploadS3Multipart(layout, filePath, fileSize, {
      userAgent,
      headers,
      onProgress: createProgressSender(event.sender, uploadId, fileSize),
    });
  });
}
