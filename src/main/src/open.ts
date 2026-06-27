import path from "node:path";
import { pathToFileURL } from "node:url";

import { shell } from "electron";

import { log } from "./logging";

/** Opens the file using the default application registered for the protocol */
export function openUrl(url: URL): void {
  shell.openExternal(url.toString()).catch((err: unknown) => {
    log("error", "failed to open URL", { url: url.toString(), error: err });
  });
}

/**
 * Opens the file or folder using the default application for the file extension.
 *
 * Routes through a `file://` URL and `shell.openExternal` rather than
 * `shell.openPath`. On native platforms both open the OS file manager for a
 * directory, but under Wine `shell.openPath` triggers a Win32 `ShellExecute`
 * "open" verb that Wine has no folder handler for, whereas `file://` URLs
 * are routed by Wine to winebrowser → the host's xdg-open.
 */
export function openFile(filePath: string): void {
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);

  shell.openExternal(pathToFileURL(resolvedPath).toString()).catch((err: unknown) => {
    log("error", "failed to open file", {
      filePath,
      resolvedPath,
      error: err,
    });
  });
}
