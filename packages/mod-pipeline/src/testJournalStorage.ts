import * as fs from "node:fs/promises";
import { join } from "node:path";

import type { JournalStorage } from "./journal";

/** A journal on the real disk, for tests; the package itself never touches a disk. */
export const nodeJournalStorage = (workDir: string): JournalStorage => {
  const journalFile = join(workDir, "journal.ndjson");
  let appending: fs.FileHandle | undefined;
  return {
    read: () =>
      fs.readFile(journalFile).catch((err: unknown) => {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
          return undefined;
        }
        throw err;
      }),
    write: async (contents) => {
      await fs.mkdir(workDir, { recursive: true });
      await fs.writeFile(`${journalFile}.tmp`, contents);
      await fs.rename(`${journalFile}.tmp`, journalFile);
    },
    append: async (contents) => {
      appending ??= await fs.open(journalFile, "a");
      await appending.appendFile(contents);
    },
    remove: () => fs.rm(journalFile, { force: true }),
    close: async () => {
      await appending?.close();
      appending = undefined;
    },
  };
};
