import turbowalk, { IEntry, IWalkOptions } from "turbowalk";
import { util } from "vortex-api";

import { IEntryEx } from "../types/IEntryEx";

export async function fileMD5Async(fileName: string): Promise<string> {
  return util.fileMD5(fileName);
}

export async function walkPath(
  dirPath: string,
  walkOptions?: IWalkOptions,
): Promise<IEntryEx[]> {
  walkOptions = walkOptions || {
    skipLinks: true,
    skipHidden: true,
    skipInaccessible: true,
  };
  const walkResults: IEntryEx[] = [];
  return new Promise<IEntryEx[]>(async (resolve, reject) => {
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
    ).catch((err) =>
      err.code === "ENOENT" ? Promise.resolve() : Promise.reject(err),
    );
    return resolve(walkResults);
  });
}
