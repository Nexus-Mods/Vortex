import { AbsolutePathSchema } from "./pathKey";
import { OperationKind, OperationSchema, type Operation } from "./plan";
import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

/**
 * Where a journal is kept, provided by the caller, as this package never touches a disk. What an
 * awaited call wrote must survive a process kill, and its bytes must be flushed to the disk, though
 * a power cut may undo the latest create, write or remove.
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

export type JournalOperation =
  | Operation
  | { kind: typeof OperationKind.Restore; destinationPath: string };

/** One step of a run; progress names it by its position. */
export interface JournalEntry {
  operation: JournalOperation;
  /** resolved when the run starts, so recovery doesn't depend on Stage */
  stagedPath?: string;
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
  done: ReadonlySet<number>;
  undone: ReadonlySet<number>;
  /** the folders the run made, so a rollback can remove them */
  createdFolders: { index: number; path: string }[];
}

export const JournalReadStatus = {
  None: "none",
  Invalid: "invalid",
  Found: "found",
} as const;

export type JournalRead =
  | { status: typeof JournalReadStatus.None }
  | { status: typeof JournalReadStatus.Invalid }
  | { status: typeof JournalReadStatus.Found; journal: Journal };

/** Appends to a run's journal. */
export interface JournalWriter {
  readonly runId: string;
  markDone(index: number): Promise<void>;
  recordFolder(index: number, folderPath: string): Promise<void>;
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
  Done: "done",
  Folder: "folder",
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
  operation: z.union([
    OperationSchema,
    z.object({
      kind: z.literal(OperationKind.Restore),
      destinationPath: AbsolutePathSchema,
    }),
  ]),
  stagedPath: AbsolutePathSchema.optional(),
});

// typecheck fails when the schema and its type drift apart
type _EntryMatches = Assert<MutuallyAssignable<z.infer<typeof entrySchema>, JournalEntry>>;

const progressSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(LineType.Done), index: positionSchema }),
  z.object({ type: z.literal(LineType.Undone), index: positionSchema }),
  z.object({ type: z.literal(LineType.Folder), index: positionSchema, path: AbsolutePathSchema }),
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
  const done = new Set<number>();
  const undone = new Set<number>();
  const createdFolders: Journal["createdFolders"] = [];
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
    if (progress.type === LineType.Done) {
      done.add(progress.index);
    } else if (progress.type === LineType.Undone) {
      undone.add(progress.index);
    } else {
      createdFolders.push({ index: progress.index, path: progress.path });
    }
  }
  return { runId: header.runId, entries, phase, done, undone, createdFolders };
}

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

const encodeLines = (lines: readonly object[]): Uint8Array =>
  new TextEncoder().encode(lines.map((line) => `${JSON.stringify(line)}\n`).join(""));

const writerFor = (storage: JournalStorage, runId: string): JournalWriter => {
  const append = (line: object) => storage.append(encodeLines([line]));
  return {
    runId,
    markDone: (index) => append({ type: LineType.Done, index }),
    recordFolder: (index, folderPath) => append({ type: LineType.Folder, index, path: folderPath }),
    startRollback: () => append({ type: LineType.Phase, phase: JournalPhase.RollingBack }),
    markUndone: (index) => append({ type: LineType.Undone, index }),
    close: () => storage.close(),
    finish: async () => {
      await storage.close();
      await storage.remove();
    },
  };
};

/** Starts a run; fails if a journal is already there. */
export async function createJournal(
  storage: JournalStorage,
  entries: readonly JournalEntry[],
): Promise<JournalWriter> {
  const runId = crypto.randomUUID();
  const header = {
    type: LineType.Header,
    version: JOURNAL_VERSION,
    runId,
    count: entries.length,
  };
  if (!(await storage.create(encodeLines([header, ...entries])))) {
    throw new Error("a journal already exists");
  }
  return writerFor(storage, runId);
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
    : { status: JournalReadStatus.Found, journal };
}

/** Continues an interrupted run, first removing a torn last line. */
export async function openJournal(storage: JournalStorage): Promise<JournalWriter> {
  const bytes = (await storage.read()) ?? new Uint8Array();
  const journal = parseJournal(decode(bytes));
  if (journal === undefined) {
    throw new Error("the journal can't be read");
  }
  const complete = bytes.subarray(0, bytes.lastIndexOf(NEWLINE) + 1);
  if (complete.length < bytes.length) {
    await storage.write(complete);
  }
  return writerFor(storage, journal.runId);
}
