import { AbsolutePathSchema, OperationSchema, type Operation } from "@nexusmods/mod-pipeline";
import { z } from "zod";

type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

/**
 * Where a journal is kept: what an awaited call wrote survives a kill and is flushed to disk; a
 * power cut may undo the latest create, write or remove.
 */
export interface JournalStorage {
  /** the whole journal, or undefined when there is none */
  read(): Promise<Uint8Array | undefined>;
  /** writes the journal atomically unless there is one already; resolves false when there is */
  create(contents: Uint8Array): Promise<boolean>;
  /** replaces the journal atomically */
  write(contents: Uint8Array): Promise<void>;
  append(contents: Uint8Array): Promise<void>;
  /** called once closed; does nothing when there is no journal */
  remove(): Promise<void>;
  close(): Promise<void>;
}

/** One step of a run; progress names it by its position. */
export interface JournalEntry {
  operation: Operation;
  /** resolved when the run starts, so recovery doesn't depend on Stage */
  stagedPath?: string;
  /** where a BACKUP moves the game's original and a RESTORE finds it; resolved when the run starts */
  backupPath?: string;
  /** where an UNLINK or a BACKUP sets its file aside; resolved when the run starts */
  keptPath?: string;
}

export const JournalPhase = {
  Applying: "applying",
  RollingBack: "rolling-back",
} as const;
export type JournalPhase = (typeof JournalPhase)[keyof typeof JournalPhase];

/** A run as its journal records it. */
export interface Journal {
  runId: string;
  entries: JournalEntry[];
  phase: JournalPhase;
  /** the entries that may have changed the disk, so a rollback undoes them */
  changing: ReadonlySet<number>;
  done: ReadonlySet<number>;
  /** the entries marked done with their file set aside */
  kept: ReadonlySet<number>;
  undone: ReadonlySet<number>;
  /** the folders the run made, so a rollback can remove them */
  createdFolders: { index: number; path: string }[];
  /** the LINKs that may have removed an empty folder at their destination, for a rollback to restore */
  removedFolders: ReadonlySet<number>;
}

export const JournalReadStatus = {
  None: "none",
  Invalid: "invalid",
  Found: "found",
} as const;

export type JournalRead =
  | { status: typeof JournalReadStatus.None }
  | { status: typeof JournalReadStatus.Invalid }
  | { status: typeof JournalReadStatus.Found; journal: Journal; bytes: Uint8Array };

/** Appends to a run's journal. */
export interface JournalWriter {
  readonly runId: string;
  /** called before the entry first changes the disk */
  markChanging(index: number): Promise<void>;
  /** `kept` when the entry set its file aside */
  markDone(index: number, kept?: boolean): Promise<void>;
  recordFolder(index: number, folderPath: string): Promise<void>;
  recordRemovedFolder(index: number): Promise<void>;
  startRollback(): Promise<void>;
  markUndone(index: number): Promise<void>;
  close(): Promise<void>;
  /** removes the journal, the last step of a run */
  finish(): Promise<void>;
}

const JOURNAL_VERSION = 1;
const NEWLINE = 0x0a;

const LineType = {
  Header: "header",
  Changing: "changing",
  Done: "done",
  Folder: "folder",
  RemovedFolder: "removed-folder",
  Phase: "phase",
  Undone: "undone",
} as const;

const positionSchema = z.number().int().nonnegative();

const headerSchema = z.object({
  type: z.literal(LineType.Header),
  version: z.literal(JOURNAL_VERSION),
  runId: z.string(),
  count: positionSchema,
});

const entrySchema = z.object({
  operation: OperationSchema,
  stagedPath: AbsolutePathSchema.optional(),
  backupPath: AbsolutePathSchema.optional(),
  keptPath: AbsolutePathSchema.optional(),
});

// typecheck fails when the schema and its type drift apart
type _EntryMatches = Assert<MutuallyAssignable<z.infer<typeof entrySchema>, JournalEntry>>;

export const JournalEntrySchema: z.ZodType<JournalEntry> = entrySchema;

const progressSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(LineType.Changing), index: positionSchema }),
  z.object({
    type: z.literal(LineType.Done),
    index: positionSchema,
    kept: z.literal(true).optional(),
  }),
  z.object({ type: z.literal(LineType.Undone), index: positionSchema }),
  z.object({ type: z.literal(LineType.Folder), index: positionSchema, path: AbsolutePathSchema }),
  z.object({ type: z.literal(LineType.RemovedFolder), index: positionSchema }),
  z.object({ type: z.literal(LineType.Phase), phase: z.enum(JournalPhase) }),
]);

const parseLine = <T>(schema: z.ZodType<T>, line: string): T | undefined => {
  try {
    const result = schema.safeParse(JSON.parse(line));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
};

/** Drops a torn last line; anything else malformed fails the whole journal. */
function parseJournal(text: string): Journal | undefined {
  const [headerLine = "", ...lines] = text.split("\n").slice(0, -1);
  const header = parseLine(headerSchema, headerLine);
  if (header === undefined || lines.length < header.count) {
    return undefined;
  }

  const entries: JournalEntry[] = [];
  for (const line of lines.slice(0, header.count)) {
    const entry = parseLine(entrySchema, line);
    if (entry === undefined) {
      return undefined;
    }
    entries.push(entry);
  }

  let phase: JournalPhase = JournalPhase.Applying;
  const changing = new Set<number>();
  const done = new Set<number>();
  const kept = new Set<number>();
  const undone = new Set<number>();
  const createdFolders: Journal["createdFolders"] = [];
  const removedFolders = new Set<number>();
  for (const line of lines.slice(header.count)) {
    const progress = parseLine(progressSchema, line);
    if (progress === undefined) {
      return undefined;
    }
    if (progress.type === LineType.Phase) {
      phase = progress.phase;
      continue;
    }
    if (progress.index >= header.count) {
      return undefined;
    }
    if (progress.type === LineType.Changing) {
      changing.add(progress.index);
    } else if (progress.type === LineType.Done) {
      done.add(progress.index);
      if (progress.kept === true) {
        kept.add(progress.index);
      }
    } else if (progress.type === LineType.Undone) {
      undone.add(progress.index);
    } else if (progress.type === LineType.Folder) {
      createdFolders.push({ index: progress.index, path: progress.path });
    } else {
      removedFolders.add(progress.index);
    }
  }
  return {
    runId: header.runId,
    entries,
    phase,
    changing,
    done,
    kept,
    undone,
    createdFolders,
    removedFolders,
  };
}

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

const encodeLines = (lines: readonly object[]): Uint8Array =>
  new TextEncoder().encode(lines.map((line) => `${JSON.stringify(line)}\n`).join(""));

const writerFor = (storage: JournalStorage, runId: string): JournalWriter => {
  const append = (line: object) => storage.append(encodeLines([line]));
  return {
    runId,
    markChanging: (index) => append({ type: LineType.Changing, index }),
    markDone: (index, kept) =>
      append(kept === true ? { type: LineType.Done, index, kept } : { type: LineType.Done, index }),
    recordFolder: (index, folderPath) => append({ type: LineType.Folder, index, path: folderPath }),
    recordRemovedFolder: (index) => append({ type: LineType.RemovedFolder, index }),
    startRollback: () => append({ type: LineType.Phase, phase: JournalPhase.RollingBack }),
    markUndone: (index) => append({ type: LineType.Undone, index }),
    close: () => storage.close(),
    finish: async () => {
      await storage.close();
      await storage.remove();
    },
  };
};

/** Starts a run; undefined when a journal is already there. */
export async function createJournal(
  storage: JournalStorage,
  entries: readonly JournalEntry[],
  runId: string,
): Promise<JournalWriter | undefined> {
  const header = {
    type: LineType.Header,
    version: JOURNAL_VERSION,
    runId,
    count: entries.length,
  };
  return (await storage.create(encodeLines([header, ...entries])))
    ? writerFor(storage, runId)
    : undefined;
}

/** A journal that can't be read is reported and left in place. */
export async function readJournal(storage: JournalStorage): Promise<JournalRead> {
  const bytes = await storage.read();
  if (bytes === undefined) {
    return { status: JournalReadStatus.None };
  }
  const journal = parseJournal(decode(bytes));
  return journal === undefined
    ? { status: JournalReadStatus.Invalid }
    : { status: JournalReadStatus.Found, journal, bytes };
}

/** Continues an interrupted run. */
export async function openJournal(storage: JournalStorage): Promise<JournalWriter> {
  const read = await readJournal(storage);
  if (read.status !== JournalReadStatus.Found) {
    throw new Error("the journal can't be read");
  }
  return continueJournal(storage, read);
}

/** Continues the run just read, first removing a torn last line. */
export async function continueJournal(
  storage: JournalStorage,
  { journal, bytes }: Extract<JournalRead, { status: typeof JournalReadStatus.Found }>,
): Promise<JournalWriter> {
  const complete = bytes.subarray(0, bytes.lastIndexOf(NEWLINE) + 1);
  if (complete.length < bytes.length) {
    await storage.write(complete);
  }
  return writerFor(storage, journal.runId);
}
