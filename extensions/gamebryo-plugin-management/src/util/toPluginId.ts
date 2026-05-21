import * as path from "path";

import { GHOST_EXT } from "../statics";

function toPluginId(fileName: string) {
  return path.basename(fileName.toLowerCase(), GHOST_EXT);
}

export default toPluginId;
