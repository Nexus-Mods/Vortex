import * as path from "node:path";

import { GHOST_EXT } from "../statics";

/** Whether the file carries the suffix a plugin is disabled with on disk, in any casing. */
export function isGhosted(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === GHOST_EXT;
}

/** The plugin's path without the ghost suffix, directory and plugin extension kept. */
export function unghost(filePath: string): string {
  return isGhosted(filePath) ? filePath.slice(0, -GHOST_EXT.length) : filePath;
}

/** The plugin's path with the ghost suffix, whether or not it carried one already. */
export function ghost(filePath: string): string {
  return unghost(filePath) + GHOST_EXT;
}
