import Promise from "bluebird";
import * as path from "path";
import { fs } from "vortex-api";

/**
 * find all files in a directory that match a certain name filter and are newer
 * than the specified age
 *
 * @param {string} gamePath
 * @param {(name: string) => boolean} nameFilter
 * @param {Date} minAge
 * @returns {Promise<string[]>}
 */
function filesNewer(
  searchPath: string,
  nameFilter: (name: string) => boolean,
  minAge: Date,
): Promise<string[]> {
  return fs
    .readdirAsync(searchPath)
    .then((files: string[]) => {
      // stat all files that match the name filter
      const matches = files.filter(nameFilter);
      return Promise.map(matches, (file) =>
        fs.statAsync(path.join(searchPath, file)).then((stats: fs.Stats) =>
          Promise.resolve({
            name: file,
            stats,
          }),
        ),
      );
    })
    .then((fileStats: Array<{ name: string; stats: fs.Stats }>) =>
      fileStats
        .filter((file) => file.stats.mtime > minAge)
        .map((file) => file.name),
    );
}

export default filesNewer;
