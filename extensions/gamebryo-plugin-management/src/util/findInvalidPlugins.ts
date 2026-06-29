import { util } from "@nexusmods/vortex-api";

import { ESPFile } from "../esp/ESPFile";
import { IPlugins } from "../types/IPlugins";

// header reads are cheap, but a large profile can hold hundreds of plugins, so bound how many files
// are open at once.
const CONCURRENCY = 16;

/**
 * libloot's loadPlugins/sortPlugins abort on the FIRST invalid plugin, so discovering invalid
 * plugins by retrying the whole operation costs one full load/sort per bad plugin. Parsing each
 * plugin's header with ESPFile finds them all in a single pass, so callers can exclude them before
 * one load and one sort. ESPFile accepts every known-good plugin (corpus test), so it won't drop
 * valid ones; anything it passes that libloot still rejects is left to the caller's fallback.
 *
 * Returns the ids whose header is corrupt or incomplete (ESPFile throws with code "EINVAL"), the
 * same condition libloot reports as "not a valid plugin". Ids with no known file path, or that fail
 * for other reasons (e.g. the file briefly missing, which throws "ENOENT"), are left for libloot to
 * judge.
 */
export async function findInvalidPlugins(
  pluginIds: string[],
  pluginList: IPlugins,
  gameMode: string,
): Promise<Set<string>> {
  const invalid = new Set<string>();
  await util.mapWithConcurrency(
    pluginIds,
    async (id: string) => {
      const filePath = pluginList[id]?.filePath;
      if (filePath === undefined) {
        return;
      }
      try {
        await ESPFile.open(filePath, gameMode);
      } catch (err) {
        if (err.code === "EINVAL") {
          invalid.add(id);
        }
      }
    },
    CONCURRENCY,
  );
  return invalid;
}
