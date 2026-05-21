import path from "node:path";

import PromiseBB from "bluebird";

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

/** @deprecated */
function open(target: string, _wait?: boolean): PromiseBB<void> {
  if (!target) {
    log("warn", "No target provided to open function");
    return PromiseBB.resolve();
  }
  if (isUrlTarget(target)) {
    window.api.shell.openUrl(target);
  } else {
    window.api.shell.openFile(target);
  }

  return PromiseBB.resolve();
}

/** @deprecated */
export default open;
