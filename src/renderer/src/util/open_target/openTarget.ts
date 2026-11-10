import { log } from "../../logging";
import { isUrlTarget } from "../is_url_target/isUrlTarget";

// Back api.openUrl and api.openFile in the extension API. Vortex's own code calls
// window.api.shell directly. Both check the target here, so a bad value from an
// extension is logged in the renderer rather than reaching main.

/**
 * Opens `url` in the default application for its scheme, such as the browser for
 * `https:`. Anything that isn't a URL with a scheme, including a filesystem path, is
 * logged and ignored: open those with `openFile`.
 */
export function openUrl(url: string): void {
  if (typeof url !== "string" || !isUrlTarget(url)) {
    log("warn", "not opening an invalid URL", { url });
    return;
  }

  window.api.shell.openUrl(url);
}

/**
 * Opens a file in its default application, or a folder in the file manager. A
 * relative path resolves against Vortex's working directory. An empty or missing
 * path is logged and ignored.
 */
export function openFile(filePath: string): void {
  if (typeof filePath !== "string" || filePath.length === 0) {
    log("warn", "not opening an invalid path", { filePath });
    return;
  }

  window.api.shell.openFile(filePath);
}
