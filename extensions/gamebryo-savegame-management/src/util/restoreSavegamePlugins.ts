import { ISavegame } from "../types/ISavegame";

import Promise from "bluebird";
import * as path from "path";
import { fs, types } from "vortex-api";

export class MissingPluginsError extends Error {
  private mFiles: string[];

  constructor(files: string[]) {
    super();
    Error.captureStackTrace(this, this.constructor);
    this.name = "MissingPluginsError";
    this.message = "Not all plugins are available";
    this.mFiles = files;
  }

  public get missingPlugins(): string[] {
    return this.mFiles;
  }
}

/**
 * Apply the plugin list as used when a save game was created.
 *
 * @param {types.IExtensionApi} api extension api
 * @param {string} modPath directory where plugins are stored
 * @param {ISavegame} save the save to restore plugins from
 * @param {types}
 */
function restoreSavegamePlugins(
  api: types.IExtensionApi,
  modPath: string,
  save: ISavegame,
): Promise<void> {
  return fs.readdirAsync(modPath).then((files: string[]) => {
    const plugins = new Set(
      files
        .map((fileName) => fileName.toLowerCase())
        .filter((fileName) => {
          const ext = path.extname(fileName);
          return [".esp", ".esm", ".esl"].indexOf(ext) !== -1;
        }),
    );

    const missing = save.attributes.plugins.filter(
      (plugin) => !plugins.has(plugin.toLowerCase()),
    );

    if (missing.length > 0) {
      return Promise.reject(new MissingPluginsError(missing));
    } else {
      api.events.emit("set-plugin-list", save.attributes.plugins);
      return Promise.resolve();
    }
  });
}

export default restoreSavegamePlugins;
