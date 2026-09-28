import * as path from "node:path";

import type { IESPFile } from "../types/IESPFile";
import type { IPluginParsed } from "../types/IPlugins";
import { supportsESL } from "./gameSupport";
import { unghost } from "./ghost";

type PluginFlags = Pick<IPluginParsed, "isMaster" | "isLight" | "isMedium">;

/**
 * The flags the plugins table shows for a plugin: the parsed header's, widened by the name
 * conventions the games apply themselves. An .esm is a master, and where the game has light
 * plugins an .esl is a light master. A ghosted plugin counts by its real extension.
 */
export function pluginFlags(
  filePath: string,
  header: Pick<IESPFile, "isMaster" | "isLight" | "isMedium">,
  gameMode: string,
): PluginFlags {
  const ext = path.extname(unghost(filePath)).toLowerCase();
  const lightPlugins = supportsESL(gameMode);
  return {
    isMaster: header.isMaster || ext === ".esm" || (lightPlugins && ext === ".esl"),
    isLight: lightPlugins && (header.isLight || ext === ".esl"),
    isMedium: header.isMedium,
  };
}
