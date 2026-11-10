import * as fs from "node:fs/promises";
import { join } from "node:path";

import type { JournalStorage } from "./journal";

/** A journal in memory, for tests that run many journals. */
export const memoryJournalStorage = (): JournalStorage => {
  let journal: Uint8Array | undefined;
  return {
    read: () => Promise.resolve(journal),
    create: (contents) => {
      if (journal !== undefined) {
        return Promise.resolve(false);
      }
      journal = contents.slice();
      return Promise.resolve(true);
    },
    write: (contents) => {
      journal = contents.slice();
      return Promise.resolve();
    },
    append: (contents) => {
      journal = Buffer.concat([journal ?? new Uint8Array(), contents]);
      return Promise.resolve();
    },
    remove: () => {
      journal = undefined;
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  };
};

/** A journal on the real disk, for tests; the package itself never touches a disk. */
export const nodeJournalStorage = (workDir: string): JournalStorage => {
  const journalFile = join(workDir, "journal.ndjson");
  let appending: Promise<fs.FileHandle> | undefined;
  return {
    read: () =>
      fs.readFile(journalFile).catch((err: unknown) => {
        if (err instanceof Error && "code" in err && err.code === "ENOENT") {
          return undefined;
        }
        throw err;
      }),
    create: async (contents) => {
      await fs.mkdir(workDir, { recursive: true });
      const candidate = `${journalFile}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(candidate, contents, { flag: "wx" });
      try {
        await fs.link(candidate, journalFile);
        return true;
      } catch (err) {
        if (err instanceof Error && "code" in err && err.code === "EEXIST") {
          return false;
        }
        throw err;
      } finally {
        await fs.rm(candidate, { force: true });
      }
    },
    write: async (contents) => {
      await fs.mkdir(workDir, { recursive: true });
      await fs.writeFile(`${journalFile}.tmp`, contents);
      await fs.rename(`${journalFile}.tmp`, journalFile);
    },
    append: async (contents) => {
      appending ??= fs.open(journalFile, "a");
      await (await appending).appendFile(contents);
    },
    remove: () => fs.rm(journalFile, { force: true }),
    close: async () => {
      const handle = appending;
      appending = undefined;
      await (await handle)?.close();
    },
  };
};
