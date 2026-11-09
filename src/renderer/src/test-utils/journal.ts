import {
  createJournal,
  type JournalEntry,
  type JournalStorage,
  type JournalWriter,
} from "@nexusmods/mod-pipeline";

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
