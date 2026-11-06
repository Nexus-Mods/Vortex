import path from "node:path";

import { log } from "../logging";

function isWindowsPath(target: string): boolean {
  return path.win32.isAbsolute(target);
}

function isUrlTarget(target: string): boolean {
  if (isWindowsPath(target)) {
    return false;
  }

  try {
    const parsed = new URL(target);
    return parsed.protocol.length > 1;
  } catch {
    return false;
  }
}

/**
 * Backs `util.opn` in the extension API and nothing else: Vortex's own code calls
 * window.api.shell directly, and lint blocks new imports of this file. It goes when
 * `util.opn` is removed under the deprecation policy in RELEASES.md (LAZ-1610).
 *
 * @deprecated use preload api window.api.shell openUrl or openFile
 */
function open(target: string, _wait?: boolean): Promise<void> {
  if (!target) {
    log("warn", "No target provided to open function");
    return Promise.resolve();
  }

  if (isUrlTarget(target)) {
    window.api.shell.openUrl(target);
  } else {
    window.api.shell.openFile(target);
  }

  return Promise.resolve();
}

/** @deprecated */
export default open;
