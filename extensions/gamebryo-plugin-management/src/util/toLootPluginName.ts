import * as path from "path";

import { IPlugins } from "../types/IPlugins";
import toPluginId from "./toPluginId";

function toLootPluginName(pluginId: string, pluginList: IPlugins): string {
  const filePath = pluginList[pluginId]?.filePath;
  if (filePath === undefined) {
    return toPluginId(pluginId);
  }
  const base = path.basename(filePath);
  return base === filePath ? path.win32.basename(filePath) : base;
}

export default toLootPluginName;
