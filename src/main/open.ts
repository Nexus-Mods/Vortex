import { shell } from "electron";
import path from "node:path";

import { log } from "./logging";

/** Opens the file using the default application registered for the protocol */
export function openUrl(url: URL): void {
  shell.openExternal(url.toString()).catch((err: unknown) => {
    log("error", "failed to open URL", { url: url.toString(), error: err });
  });
}

/** Opens the file using the default application for the file extension */
export function openFile(filePath: string): void {
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(filePath);

  shell
    .openPath(resolvedPath)
    .then((errorMessage) => {
      if (!errorMessage) return;
      log("error", "failed to open file", {
        filePath,
        resolvedPath,
        message: errorMessage,
      });
    })
    .catch((err: unknown) => {
      log("error", "failed to open file", {
        filePath,
        resolvedPath,
        error: err,
      });
    });
}
