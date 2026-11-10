import {
  continueJournal,
  createJournal,
  JournalEntrySchema,
  JournalPhase,
  JournalReadStatus,
  readJournal,
  type Journal,
  type JournalEntry,
  type JournalStorage,
  type JournalWriter,
} from "./journal";
import { FileSourceKind, type FileSource } from "./lockfile";
import { KeptReason, OperationKind, parentFolders, type Operation } from "./plan";

/** The file work a run needs, provided by the caller. */
export interface ApplyFiles {
  /** an id shared by a file's hardlinks, and its link count; undefined when nothing is there */
  statusAt(path: string): Promise<{ id: string; linkCount: number } | undefined>;
  /** fails when `to` is taken or on another drive */
  move(from: string, to: string): Promise<void>;
  /** hardlinks `from` at `to`; fails when `to` is taken */
  link(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
  /** makes a folder and those above it; does nothing when it is there */
  createFolder(path: string): Promise<void>;
  /** does nothing when the folder is missing or holds anything, or a file is there */
  removeEmptyFolder(path: string): Promise<void>;
}

/** Where Stage keeps a lockfile's files. */
export interface StagedFiles {
  pathOf(file: FileSource): string | undefined;
}

export interface RunOptions {
  files: ApplyFiles;
  journal: JournalStorage;
}

export interface ApplyOptions extends RunOptions {
  stagedFiles: StagedFiles;
  /**
   * where a BACKUP moves the game's original at `destinationPath` and a RESTORE finds it: absolute
   * and on the destination's drive
   */
  backupPathOf: (destinationPath: string) => string;
  /**
   * where the run sets aside a file it can't show is ours or the game's original: absolute, on the
   * destination's drive, and unique to the run and entry
   */
  keptPathOf: (destinationPath: string, runId: string, entryIndex: number) => string;
}

export const ApplyStatus = {
  Applied: "applied",
  Unfinished: "unfinished",
  Refused: "refused",
  RolledBack: "rolled-back",
  RollbackFailed: "rollback-failed",
  NothingToDo: "nothing-to-do",
} as const;

/** Why a run didn't start; nothing on disk changed. */
export const RefusalReason = {
  JournalExists: "journal-exists",
  JournalUnavailable: "journal-unavailable",
  GeneratedFile: "generated-file",
  NoStagedFile: "no-staged-file",
  InvalidPath: "invalid-path",
} as const;
export type RefusalReason = (typeof RefusalReason)[keyof typeof RefusalReason];

/** What failed; a failure outside any one step names no step. */
export interface FailedStep {
  cause: unknown;
  index?: number;
  operation?: Operation;
}

/** A file a run set aside, and why. */
export interface KeptFile {
  destinationPath: string;
  keptPath: string;
  reason: KeptReason;
}

export interface AppliedResult {
  status: typeof ApplyStatus.Applied;
  kept: KeptFile[];
}
/** Every step ran, but the journal couldn't be ended; {@link resumeApply} ends it. */
export interface UnfinishedResult {
  status: typeof ApplyStatus.Unfinished;
  cause: unknown;
}
export interface RefusedResult {
  status: typeof ApplyStatus.Refused;
  reason: RefusalReason;
  path?: string;
  cause?: unknown;
}
export interface RolledBackResult {
  status: typeof ApplyStatus.RolledBack;
  /** absent when the rollback was asked for */
  failedAt?: FailedStep;
}
/** The journal stays, so a further call continues. */
export interface RollbackFailedResult {
  status: typeof ApplyStatus.RollbackFailed;
  rollbackFailedAt: FailedStep;
  failedAt?: FailedStep;
}
export interface NothingToDoResult {
  status: typeof ApplyStatus.NothingToDo;
}

export type ApplyResult =
  | AppliedResult
  | UnfinishedResult
  | RefusedResult
  | RolledBackResult
  | RollbackFailedResult;
export type ResumeResult = ApplyResult | NothingToDoResult;
export type RollbackResult =
  | RefusedResult
  | RolledBackResult
  | RollbackFailedResult
  | NothingToDoResult;

function keptPathIn({ operation, keptPath }: JournalEntry): string {
  if (keptPath === undefined) {
    throw new Error(`nowhere to keep ${destinationOf(operation)}`);
  }
  return keptPath;
}

function backupPathIn({ operation, backupPath }: JournalEntry): string {
  if (backupPath === undefined) {
    throw new Error(`no backup path for ${destinationOf(operation)}`);
  }
  return backupPath;
}

/** The id at a path, shared by a file's hardlinks. */
const idAt = async (files: ApplyFiles, path: string) => (await files.statusAt(path))?.id;

/**
 * Items for a `for await` whose body runs one at a time: a run's steps depend on the ones before.
 * @yields each item
 */
async function* oneAtATime<T>(items: Iterable<T>): AsyncGenerator<T> {
  yield* items;
}

const destinationOf = (operation: Operation) =>
  "file" in operation ? operation.file.destinationPath : operation.destinationPath;

const refused = (reason: RefusalReason, details: Partial<RefusedResult> = {}): RefusedResult => ({
  status: ApplyStatus.Refused,
  reason,
  ...details,
});

/** A run's state, kept as its journal records it. */
interface Run {
  files: ApplyFiles;
  writer: JournalWriter;
  entries: readonly JournalEntry[];
  phase: JournalPhase;
  /** the entries that may have changed the disk; a rollback undoes only these */
  changing: Set<number>;
  done: Set<number>;
  /** the entries whose file the run set aside */
  kept: Set<number>;
  undone: ReadonlySet<number>;
  /** by entry, deepest first */
  createdFolders: Map<number, string[]>;
  removedFolders: Set<number>;
}

function addFolder(folders: Map<number, string[]>, index: number, path: string): void {
  folders.set(index, [...(folders.get(index) ?? []), path]);
}

const foldersByEntry = (folders: readonly { index: number; path: string }[]) => {
  const byEntry = new Map<number, string[]>();
  for (const { index, path } of folders) {
    addFolder(byEntry, index, path);
  }
  return byEntry;
};

/** The journal's entries for a plan, resolved once so recovery doesn't depend on current state. */
function entriesFor(
  operations: readonly Operation[],
  { stagedFiles, backupPathOf, keptPathOf }: ApplyOptions,
  runId: string,
): JournalEntry[] | RefusedResult {
  const entries: JournalEntry[] = [];
  for (const operation of operations) {
    const destinationPath = destinationOf(operation);
    if ("file" in operation && operation.file.source === FileSourceKind.VortexGenerated) {
      return refused(RefusalReason.GeneratedFile, { path: destinationPath });
    }
    switch (operation.kind) {
      case OperationKind.Backup:
        entries.push(
          operation.setAside !== undefined
            ? { operation, keptPath: keptPathOf(destinationPath, runId, entries.length) }
            : { operation, backupPath: backupPathOf(destinationPath) },
        );
        break;
      case OperationKind.Restore:
        entries.push({ operation, backupPath: backupPathOf(destinationPath) });
        break;
      case OperationKind.Link: {
        const stagedPath = stagedFiles.pathOf(operation.file);
        if (stagedPath === undefined) {
          return refused(RefusalReason.NoStagedFile, { path: destinationPath });
        }
        entries.push({ operation, stagedPath });
        break;
      }
      case OperationKind.Unlink:
        entries.push({
          operation,
          stagedPath: stagedFiles.pathOf(operation.file),
          keptPath: keptPathOf(destinationPath, runId, entries.length),
        });
        break;
      default: {
        const exhausted: never = operation;
        return exhausted;
      }
    }
  }
  // the journal would refuse these when read back
  const unreadable = entries.find((entry) => !JournalEntrySchema.safeParse(entry).success);
  return unreadable === undefined
    ? entries
    : refused(RefusalReason.InvalidPath, { path: destinationOf(unreadable.operation) });
}

/** Records, once, that an entry is about to change the disk. */
async function markChanging(run: Run, index: number): Promise<void> {
  if (!run.changing.has(index)) {
    await run.writer.markChanging(index);
    run.changing.add(index);
  }
}

/** Records and makes the folders above a destination that aren't there. */
async function createParents(run: Run, index: number, destinationPath: string): Promise<void> {
  const missing: string[] = [];
  for await (const folder of oneAtATime(parentFolders(destinationPath))) {
    if ((await idAt(run.files, folder)) !== undefined) {
      break;
    }
    missing.push(folder);
  }
  const [deepest] = missing;
  if (deepest === undefined) {
    return;
  }
  for await (const folder of oneAtATime(missing)) {
    await run.writer.recordFolder(index, folder);
    addFolder(run.createdFolders, index, folder);
  }
  await run.files.createFolder(deepest);
}

/** Moves a file, making and recording any missing folders. */
async function moveInto(run: Run, index: number, from: string, to: string): Promise<void> {
  try {
    await run.files.move(from, to);
  } catch {
    // a missing folder; a real failure recurs
    await createParents(run, index, to);
    await run.files.move(from, to);
  }
}

/** Sets the file at `from` aside to `keptPath`, marking the entry kept. */
async function setAside(
  run: Run,
  index: number,
  from: string,
  fromId: string | undefined,
  keptPath: string,
): Promise<void> {
  if (fromId === undefined) {
    // set aside already, when a kill came between the move and its mark
    if ((await idAt(run.files, keptPath)) !== undefined) {
      run.kept.add(index);
    }
    return;
  }
  await markChanging(run, index);
  await moveInto(run, index, from, keptPath);
  run.kept.add(index);
}

/** Whether the file a destination holds, by its id, is the staged file. */
const isStagedFile = async (
  files: ApplyFiles,
  destinationId: string | undefined,
  stagedPath: string | undefined,
) =>
  destinationId !== undefined &&
  stagedPath !== undefined &&
  destinationId === (await idAt(files, stagedPath));

/** Settles a LINK that couldn't link straight away, from what was at its destination. */
async function linkFromDisk(
  run: Run,
  index: number,
  destinationPath: string,
  stagedPath: string,
  destinationId: string | undefined,
): Promise<void> {
  const { files } = run;
  if (destinationId !== undefined) {
    await run.writer.recordRemovedFolder(index);
    run.removedFolders.add(index);
    await files.removeEmptyFolder(destinationPath);
    if ((await idAt(files, destinationPath)) !== undefined) {
      throw new Error(`something else is at ${destinationPath}`);
    }
  }
  await createParents(run, index, destinationPath);
  await files.link(stagedPath, destinationPath);
}

/** Runs one entry, checking the disk first, so it is safe to repeat. */
async function applyEntry(run: Run, index: number, entry: JournalEntry): Promise<void> {
  const { files } = run;
  const { operation, stagedPath } = entry;
  const destinationPath = destinationOf(operation);
  switch (operation.kind) {
    case OperationKind.Backup: {
      const destination = await files.statusAt(destinationPath);
      if (entry.keptPath !== undefined) {
        await setAside(run, index, destinationPath, destination?.id, entry.keptPath);
        return;
      }
      if (destination === undefined) {
        return;
      }
      // a file linked elsewhere isn't the game's original
      if (destination.linkCount !== 1) {
        throw new Error(`${destinationPath} has another hardlink, so it isn't the game's original`);
      }
      await markChanging(run, index);
      await moveInto(run, index, destinationPath, backupPathIn(entry));
      return;
    }
    case OperationKind.Unlink: {
      const destinationId = await idAt(files, destinationPath);
      if (await isStagedFile(files, destinationId, stagedPath)) {
        await markChanging(run, index);
        await files.remove(destinationPath);
        return;
      }
      await setAside(run, index, destinationPath, destinationId, keptPathIn(entry));
      return;
    }
    case OperationKind.Restore: {
      const backupPath = backupPathIn(entry);
      if ((await idAt(files, backupPath)) !== undefined) {
        await markChanging(run, index);
        await files.move(backupPath, destinationPath);
      }
      return;
    }
    case OperationKind.Link: {
      if (stagedPath === undefined) {
        throw new Error(`no staged file to link at ${destinationPath}`);
      }
      const destinationId = await idAt(files, destinationPath);
      if (await isStagedFile(files, destinationId, stagedPath)) {
        return;
      }
      await markChanging(run, index);
      try {
        await files.link(stagedPath, destinationPath);
      } catch {
        // a taken destination or a missing folder; a real failure recurs
        await linkFromDisk(run, index, destinationPath, stagedPath, destinationId);
      }
      return;
    }
    default: {
      const exhausted: never = operation;
      throw new Error(`unknown operation ${JSON.stringify(exhausted)}`);
    }
  }
}

/** Undoes one entry, which may not have run, as the disk shows. */
async function undoEntry(run: Run, index: number, entry: JournalEntry): Promise<void> {
  const { files } = run;
  const { operation, stagedPath } = entry;
  const destinationPath = destinationOf(operation);
  switch (operation.kind) {
    case OperationKind.Link: {
      const destinationId = await idAt(files, destinationPath);
      if (destinationId === undefined) {
        return;
      }
      if (await isStagedFile(files, destinationId, stagedPath)) {
        await files.remove(destinationPath);
      } else if (
        run.done.has(index) &&
        // a folder this LINK removed, put back by an undo a kill cut short
        !run.removedFolders.has(index)
      ) {
        throw new Error(`something else is at ${destinationPath}`);
      }
      return;
    }
    case OperationKind.Restore: {
      const backupPath = backupPathIn(entry);
      if (
        (await idAt(files, backupPath)) === undefined &&
        (await idAt(files, destinationPath)) !== undefined
      ) {
        await files.move(destinationPath, backupPath);
      }
      return;
    }
    case OperationKind.Unlink: {
      const keptPath = keptPathIn(entry);
      if ((await idAt(files, keptPath)) !== undefined) {
        await files.move(keptPath, destinationPath);
      } else if (stagedPath !== undefined && (await idAt(files, destinationPath)) === undefined) {
        await files.link(stagedPath, destinationPath);
      }
      return;
    }
    case OperationKind.Backup: {
      const movedTo = entry.keptPath ?? backupPathIn(entry);
      if ((await idAt(files, movedTo)) === undefined) {
        return;
      }
      // it never moved, so what is at its backup name isn't its file
      if (!run.done.has(index) && (await idAt(files, destinationPath)) !== undefined) {
        return;
      }
      await files.move(movedTo, destinationPath);
      return;
    }
    default: {
      const exhausted: never = operation;
      throw new Error(`unknown operation ${JSON.stringify(exhausted)}`);
    }
  }
}

/** Returns the folders an entry changed to how it found them. */
async function undoFolders(run: Run, index: number, entry: JournalEntry): Promise<void> {
  const created = run.createdFolders.get(index);
  if (created !== undefined) {
    for await (const folder of oneAtATime(created)) {
      await run.files.removeEmptyFolder(folder);
    }
  }
  if (run.removedFolders.has(index)) {
    const folder = destinationOf(entry.operation);
    if ((await idAt(run.files, folder)) === undefined) {
      await run.files.createFolder(folder);
    }
  }
}

/** The files the run set aside, with why. */
const keptFiles = (run: Run): KeptFile[] =>
  run.entries
    .filter((_, index) => run.kept.has(index))
    .map((entry) => ({
      destinationPath: destinationOf(entry.operation),
      keptPath: keptPathIn(entry),
      reason:
        entry.operation.kind === OperationKind.Backup && entry.operation.setAside !== undefined
          ? entry.operation.setAside
          : KeptReason.NotOurs,
    }));

/** Undoes the entries that changed the disk, newest first; the journal goes last. */
async function rollBack(
  run: Run,
  failedAt?: FailedStep,
): Promise<RolledBackResult | RollbackFailedResult> {
  const stopped = (rollbackFailedAt: FailedStep): RollbackFailedResult => ({
    status: ApplyStatus.RollbackFailed,
    rollbackFailedAt,
    failedAt,
  });
  try {
    if (run.phase !== JournalPhase.RollingBack) {
      await run.writer.startRollback();
    }
  } catch (cause) {
    return stopped({ cause });
  }

  for await (const [index, entry] of oneAtATime([...run.entries.entries()].toReversed())) {
    if (run.undone.has(index) || !run.changing.has(index)) {
      continue;
    }
    try {
      await undoEntry(run, index, entry);
      await undoFolders(run, index, entry);
      await run.writer.markUndone(index);
    } catch (cause) {
      return stopped({ cause, index, operation: entry.operation });
    }
  }

  try {
    await run.writer.finish();
  } catch (cause) {
    return stopped({ cause });
  }
  return { status: ApplyStatus.RolledBack, failedAt };
}

/** Runs what isn't marked done; a failed step stops the run and rolls it back. */
async function runForward(run: Run): Promise<ApplyResult> {
  for await (const [index, entry] of oneAtATime(run.entries.entries())) {
    if (run.done.has(index)) {
      continue;
    }
    try {
      await applyEntry(run, index, entry);
      await run.writer.markDone(index, run.kept.has(index));
      run.done.add(index);
    } catch (cause) {
      return rollBack(run, { cause, index, operation: entry.operation });
    }
  }
  try {
    await run.writer.finish();
    return { status: ApplyStatus.Applied, kept: keptFiles(run) };
  } catch (cause) {
    return { status: ApplyStatus.Unfinished, cause };
  }
}

const runOf = (files: ApplyFiles, writer: JournalWriter, journal: Omit<Journal, "runId">): Run => ({
  files,
  writer,
  entries: journal.entries,
  phase: journal.phase,
  changing: new Set(journal.changing),
  done: new Set(journal.done),
  kept: new Set(journal.kept),
  undone: journal.undone,
  createdFolders: foldersByEntry(journal.createdFolders),
  removedFolders: new Set(journal.removedFolders),
});

/** Always ends with the journal closed; a handle that won't close leaves the journal intact. */
async function closingAfter<T>(writer: JournalWriter, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } finally {
    await writer.close().catch(() => undefined);
  }
}

/** Runs a plan. Refuses while a journal exists: {@link resumeApply} or {@link rollback} settle it. */
export async function apply(
  operations: readonly Operation[],
  options: ApplyOptions,
): Promise<ApplyResult> {
  try {
    const { status } = await readJournal(options.journal);
    if (status !== JournalReadStatus.None) {
      return refused(
        status === JournalReadStatus.Found
          ? RefusalReason.JournalExists
          : RefusalReason.JournalUnavailable,
      );
    }
  } catch (cause) {
    return refused(RefusalReason.JournalUnavailable, { cause });
  }

  const runId = crypto.randomUUID();
  const entries = entriesFor(operations, options, runId);
  if (!Array.isArray(entries)) {
    return entries;
  }

  let writer: JournalWriter | undefined;
  try {
    writer = await createJournal(options.journal, entries, runId);
  } catch (cause) {
    return refused(RefusalReason.JournalUnavailable, { cause });
  }
  // another run can create its journal between the read above and this one
  if (writer === undefined) {
    return refused(RefusalReason.JournalExists);
  }
  const run = runOf(options.files, writer, {
    entries,
    phase: JournalPhase.Applying,
    changing: new Set(),
    done: new Set(),
    kept: new Set(),
    undone: new Set(),
    createdFolders: [],
    removedFolders: new Set(),
  });
  return closingAfter(writer, () => runForward(run));
}

/** Runs `work` on the run a journal left. */
async function settle<R>(
  { files, journal }: RunOptions,
  work: (run: Run) => Promise<R>,
): Promise<R | RefusedResult | NothingToDoResult> {
  let run: Run;
  try {
    const read = await readJournal(journal);
    if (read.status === JournalReadStatus.None) {
      return { status: ApplyStatus.NothingToDo };
    }
    if (read.status === JournalReadStatus.Invalid) {
      return refused(RefusalReason.JournalUnavailable);
    }
    run = runOf(files, await continueJournal(journal, read), read.journal);
  } catch (cause) {
    return refused(RefusalReason.JournalUnavailable, { cause });
  }
  return closingAfter(run.writer, () => work(run));
}

/** Settles the run a journal holds: finishes its own list, or finishes a rollback already begun. */
export function resumeApply(options: RunOptions): Promise<ResumeResult> {
  return settle(options, (run) =>
    run.phase === JournalPhase.RollingBack ? rollBack(run) : runForward(run),
  );
}

/** Returns the disk to where the journal's run started. */
export function rollback(options: RunOptions): Promise<RollbackResult> {
  return settle(options, (run) => rollBack(run));
}
