import { getErrorCode } from "@vortex/shared";
import type { IEntry, IWalkOptions } from "turbowalk";
import turbowalk from "turbowalk";

import { fileMD5 } from "../../../util/checksum";
import type { IEntryEx } from "../types/IEntryEx";

export async function fileMD5Async(fileName: string): Promise<string> {
  return fileMD5(fileName);
}

export async function walkPath(dirPath: string, walkOptions?: IWalkOptions): Promise<IEntryEx[]> {
  walkOptions = walkOptions || {
    skipLinks: true,
    skipHidden: true,
    skipInaccessible: true,
  };
  const walkResults: IEntryEx[] = [];
  await turbowalk(
    dirPath,
    async (entries: IEntry[]) => {
      for (const entry of entries) {
        const md5 = await fileMD5Async(entry.filePath);
        const extendedEntry: IEntryEx = { ...entry, fileMD5: md5 };
        walkResults.push(extendedEntry);
      }
      return Promise.resolve();
    },
    walkOptions,
  ).catch((err: unknown) =>
    getErrorCode(err) === "ENOENT" ? Promise.resolve() : Promise.reject(err),
  );
  return walkResults;
}
