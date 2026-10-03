import { existsSync, statSync } from "fs";
import * as path from "path";

import * as winapi from "winapi-bindings";

/**
 * Returns the root of the volume containing the path: the drive on Windows,
 * the mount point elsewhere. Like the Windows API, the path doesn't need to exist.
 */
export function getVolumePath(filePath: string): string {
  if (process.platform === "win32") {
    return winapi.GetVolumePathName(filePath);
  }

  let current = path.resolve(filePath);
  while (!existsSync(current)) {
    current = path.dirname(current);
  }
  const device = statSync(current).dev;
  // climb until the parent sits on another device
  while (path.dirname(current) !== current && statSync(path.dirname(current)).dev === device) {
    current = path.dirname(current);
  }
  return current;
}
