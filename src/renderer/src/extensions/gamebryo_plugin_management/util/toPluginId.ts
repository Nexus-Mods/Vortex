import * as path from "path";

import { unghost } from "./ghost";

function toPluginId(fileName: string) {
  return path.basename(unghost(fileName)).toLowerCase();
}

export default toPluginId;
