import * as fs from "node:fs/promises";
import * as path from "node:path";

import { getErrorCode, getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../../../logging";
import { withFileRetry } from "../../../util/fileRetry";
import type { JournalStorage } from "./apply/journal";

/** About 1.5 s while a scanner or indexer holds the journal, which a run can wait for */
const ATTEMPTS_WHILE_HELD = 16;

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
      await withFileRetry(() => fs.rename(temporaryFile, journalFile), ATTEMPTS_WHILE_HELD);
    },
    append: async (contents) => {
      appending ??= withFileRetry(() => fs.open(journalFile, "a"), ATTEMPTS_WHILE_HELD);
      const handle = await appending;
      await handle.appendFile(contents);
      await handle.sync();
    },
    remove: () => withFileRetry(() => fs.rm(journalFile, { force: true }), ATTEMPTS_WHILE_HELD),
    close,
  };
}
