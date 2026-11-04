import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { JournalStorage } from "@nexusmods/mod-pipeline";
import { getErrorCode } from "@vortex/shared";

/**
 * Apply's journal on disk, through node:fs: FileSystem's write streams can't append, and a kill can
 * lose what they report as written.
 */
export function journalStorageAt(journalFile: string): JournalStorage {
  const temporaryFile = `${journalFile}.tmp`;
  let appending: fs.FileHandle | undefined;

  const close = async () => {
    const handle = appending;
    appending = undefined;
    await handle?.close();
  };

  return {
    read: async () => {
      try {
        return await fs.readFile(journalFile);
      } catch (err) {
        if (getErrorCode(err) === "ENOENT") {
          return undefined;
        }
        throw err;
      }
    },
    write: async (contents) => {
      // Windows refuses to replace a file that is open
      await close();
      await fs.mkdir(path.dirname(journalFile), { recursive: true });
      await fs.writeFile(temporaryFile, contents);
      await fs.rename(temporaryFile, journalFile);
    },
    append: async (contents) => {
      appending ??= await fs.open(journalFile, "a");
      await appending.appendFile(contents);
    },
    remove: () => fs.rm(journalFile, { force: true }),
    close,
  };
}
