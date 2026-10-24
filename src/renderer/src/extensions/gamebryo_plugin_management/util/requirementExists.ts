import { stat } from "node:fs/promises";
import * as path from "node:path";

import { type DirEntryCache, resolvePathCase } from "../../../util/resolvePathCase";

const PLUGIN_EXTENSIONS = [".esp", ".esl", ".esm"];

/**
 * Whether a LOOT requirement or incompatibility is present: a plugin by its lowercase
 * id, any other file below the data folder regardless of the case it's spelled with.
 */
export async function requirementExists(
  dataPath: string,
  id: string,
  enabledPlugins: Set<string>,
  cache?: DirEntryCache,
): Promise<boolean> {
  if (PLUGIN_EXTENSIONS.includes(path.extname(id))) {
    return enabledPlugins.has(id);
  }
  const relPath = await resolvePathCase(dataPath, id, cache);
  return stat(path.join(dataPath, relPath)).then(
    () => true,
    () => false,
  );
}
