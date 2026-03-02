import walk from "./walk";

import PromiseBB from "bluebird";
import type * as fs from "fs";
import { getErrorCode } from "@vortex/shared";

export interface IFileEntry {
  filePath: string;
  stats: fs.Stats;
}

export const IGNORABLE_PREFIXES = ["__vortex", "__merged"];

function getFileList(basePath: string): PromiseBB<IFileEntry[]> {
  const result: IFileEntry[] = [];

  return walk(basePath, (filePath: string, stats: fs.Stats) => {
    if (
      !IGNORABLE_PREFIXES.some((prefix) =>
        filePath.toLowerCase().startsWith(prefix),
      )
    ) {
      result.push({ filePath, stats });
    }
    return PromiseBB.resolve();
  })
    .then(() => result)
    .catch((err) => {
      const code = getErrorCode(err);
      if (code === "ENOENT") {
        // if the directory doesn't exist it obviously doesn't contain files, right?
        return PromiseBB.resolve([]);
      } else {
        return PromiseBB.reject(err);
      }
    });
}

export default getFileList;
