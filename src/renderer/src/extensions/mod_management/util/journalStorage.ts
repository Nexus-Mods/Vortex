import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { JournalStorage } from "@nexusmods/mod-pipeline";
import { getErrorCode, getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../../../logging";
import { withFileRetry } from "../../../util/fileRetry";

/** About 1.5 s, which a resume can wait for */
const RENAME_ATTEMPTS = 16;

/**
 * Apply's journal on disk, through node:fs: FileSystem's write streams can't append, and a kill can
 * lose what they report as written.
 */
export function journalStorageAt(journalFile: string): JournalStorage {
  const temporaryFile = `${journalFile}.tmp`;
  // the promise, so overlapping appends share one handle
  let appending: Promise<fs.FileHandle> | undefined;

  const close = async () => {
    const handle = appending;
    appending = undefined;
    await (await handle)?.close();
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
    create: async (contents) => {
      await fs.mkdir(path.dirname(journalFile), { recursive: true });
      // unique, so overlapping creates can't write over each other's temporary file
      const candidate = `${journalFile}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(candidate, contents, { flag: "wx", flush: true });
      try {
        await fs.link(candidate, journalFile);
        return true;
      } catch (err) {
        if (getErrorCode(err) === "EEXIST") {
          return false;
        }
        throw err;
      } finally {
        // the journal is settled either way, and nothing reads a leftover temporary file
        await fs.rm(candidate, { force: true }).catch((err: unknown) =>
          log("warn", "couldn't remove a temporary journal file", {
            candidate,
            error: getErrorMessageOrDefault(err),
          }),
        );
      }
    },
    write: async (contents) => {
      // Windows refuses to replace a file that is open
      await close();
      await fs.mkdir(path.dirname(journalFile), { recursive: true });
      await fs.writeFile(temporaryFile, contents, { flush: true });
      // a scanner or indexer can hold the journal for a moment after it changes
      await withFileRetry(() => fs.rename(temporaryFile, journalFile), RENAME_ATTEMPTS);
    },
    append: async (contents) => {
      appending ??= fs.open(journalFile, "a");
      const handle = await appending;
      await handle.appendFile(contents);
      await handle.sync();
    },
    remove: () => fs.rm(journalFile, { force: true }),
    close,
  };
}
