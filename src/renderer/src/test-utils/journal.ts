import * as path from "node:path";

import {
  createJournal,
  type JournalEntry,
  type JournalStorage,
  type JournalWriter,
} from "../extensions/mod_management/util/apply/journal";
import { journalStorageAt } from "../extensions/mod_management/util/journalStorage";
import { makeTempDir } from "./tempDir";

/** Journal storage in a new temporary folder, holding no journal. */
export const newJournal = async (): Promise<JournalStorage> =>
  journalStorageAt(path.join(await makeTempDir("apply-journal-"), "journal.ndjson"));

/** Journal storage whose journal can't be parsed. */
export async function unreadableJournal(): Promise<JournalStorage> {
  const journal = await newJournal();
  await journal.write(new TextEncoder().encode("{ not json\n"));
  return journal;
}

/** Starts a run's journal holding `entries`, on storage that has none. */
export async function startJournal(
  storage: JournalStorage,
  entries: JournalEntry[],
  runId: string,
): Promise<JournalWriter> {
  const writer = await createJournal(storage, entries, runId);
  if (writer === undefined) {
    throw new Error("a journal was already there");
  }
  return writer;
}
