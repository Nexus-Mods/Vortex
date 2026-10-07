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

/** @deprecated use preload api window.api.shell openUrl or openFile */
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
