import PromiseBB from "bluebird";
import path from "node:path";

import { getPreloadApi } from "./preloadAccess";

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

/** @deprecated */
function open(target: string, _wait?: boolean): PromiseBB<void> {
  if (isUrlTarget(target)) {
    getPreloadApi().shell.openUrl(target);
  } else {
    getPreloadApi().shell.openFile(target);
  }

  return PromiseBB.resolve();
}

/** @deprecated */
export default open;
