/* eslint-disable */
import path from "path";

import { fs, types } from "@nexusmods/vortex-api";
import memoizeOne from "memoize-one";

import { gameDataPath, IGameSupport, pluginExtensions } from "./gameSupport";

export const patternMatchNativePlugins = memoizeOne(
  async (
    gameMode: string,
    discovery: types.IDiscoveryResult,
    gameSupport: IGameSupport,
  ): Promise<string[]> => {
    if (!discovery?.path || !gameSupport?.nativePluginsPatterns) {
      return [];
    }
    const pluginsPath = gameDataPath(gameMode);
    const files = await fs.readdirAsync(pluginsPath);
    const supportedPluginsExt = pluginExtensions(gameMode);
    const filtered = files.filter((file) =>
      supportedPluginsExt.includes(path.extname(file.toLowerCase())),
    );
    const matches = filtered.reduce((accum, file) => {
      const lowered = file.toLowerCase();
      for (const pattern of gameSupport.nativePluginsPatterns) {
        const regExp = new RegExp(pattern, "i");
        if (regExp.test(lowered)) {
          accum.push(lowered);
        }
      }
      return accum;
    }, [] as string[]);
    return Array.from(new Set<string>(matches));
  },
);
