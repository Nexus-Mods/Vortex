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
