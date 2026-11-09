import {
  continueJournal,
  createJournal,
  JournalEntrySchema,
  JournalPhase,
  JournalReadStatus,
  readJournal,
  type Journal,
  type JournalEntry,
  type JournalOperation,
  type JournalStorage,
  type JournalWriter,
} from "./journal";
import { FileSourceKind, type FileSource } from "./lockfile";
import { pathKeyOf } from "./pathKey";
import { OperationKind, parentFolders, type Operation } from "./plan";

/** The file work a run needs, provided by the caller. */
export interface ApplyFiles {
  /** identifies what is at a path, the same for hardlinks of one file; undefined when nothing is */
  idAt(path: string): Promise<string | undefined>;
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
  /** where a BACKUP moves the game file at `destinationPath` and a RESTORE finds it; absolute */
  backupPathOf: (destinationPath: string) => string;
  /** where an UNLINK keeps a file it can't show is ours; absolute and unique to the run and entry */
  unlinkKeptPathOf: (destinationPath: string, runId: string, entryIndex: number) => string;
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
  BackupNameTaken: "backup-name-taken",
  InvalidPath: "invalid-path",
  FilesUnavailable: "files-unavailable",
} as const;
export type RefusalReason = (typeof RefusalReason)[keyof typeof RefusalReason];

/** What failed; a failure outside any one step names no step. */
export interface FailedStep {
  cause: unknown;
  index?: number;
  operation?: JournalOperation;
}

/** A file an UNLINK kept, as it can't be shown to be ours. */
export interface KeptFile {
  destinationPath: string;
  keptPath: string;
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

/**
 * Items for a `for await` whose body runs one at a time: a run's steps depend on the ones before.
 * @yields each item
 */
async function* oneAtATime<T>(items: Iterable<T>): AsyncGenerator<T> {
  yield* items;
}

const destinationOf = (operation: JournalOperation) =>
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
  done: Set<number>;
  /** the UNLINKs whose file the run kept */
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

/** The paths the plan's LINKs need: their destinations and the folders above them. */
function linkedKeysOf(operations: readonly Operation[]): Set<string> {
  const keys = new Set<string>();
  for (const operation of operations) {
    if (operation.kind === OperationKind.Link) {
      keys.add(pathKeyOf(operation.file.destinationPath));
      for (const folder of parentFolders(operation.file.destinationPath)) {
        const key = pathKeyOf(folder);
        // the folders above it are in already
        if (keys.has(key)) {
          break;
        }
        keys.add(key);
      }
    }
  }
  return keys;
}

/** The journal's entries for a plan, resolved once so recovery doesn't depend on current state. */
async function entriesFor(
  operations: readonly Operation[],
  { files, stagedFiles, backupPathOf, unlinkKeptPathOf }: ApplyOptions,
  runId: string,
): Promise<JournalEntry[] | RefusedResult> {
  const linkedKeys = linkedKeysOf(operations);
  const entries: JournalEntry[] = [];
  for await (const operation of oneAtATime(operations)) {
    const destinationPath = destinationOf(operation);
    if ("file" in operation && operation.file.source === FileSourceKind.VortexGenerated) {
      return refused(RefusalReason.GeneratedFile, { path: destinationPath });
    }
    switch (operation.kind) {
      case OperationKind.Backup: {
        const backupPath = backupPathOf(destinationPath);
        if ((await files.idAt(backupPath)) !== undefined) {
          return refused(RefusalReason.BackupNameTaken, { path: destinationPath });
        }
        entries.push({ operation, keptPath: backupPath });
        break;
      }
      case OperationKind.Link: {
        const stagedPath = stagedFiles.pathOf(operation.file);
        if (stagedPath === undefined) {
          return refused(RefusalReason.NoStagedFile, { path: destinationPath });
        }
        entries.push({ operation, stagedPath });
        break;
      }
      case OperationKind.Unlink: {
        entries.push({
          operation,
          stagedPath: stagedFiles.pathOf(operation.file),
          keptPath: unlinkKeptPathOf(destinationPath, runId, entries.length),
        });
        const backupPath = backupPathOf(destinationPath);
        if (
          !linkedKeys.has(pathKeyOf(destinationPath)) &&
          (await files.idAt(backupPath)) !== undefined
        ) {
          entries.push({
            operation: { kind: OperationKind.Restore, destinationPath },
            keptPath: backupPath,
          });
        }
        break;
      }
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

/** Records and makes the folders above a destination that aren't there. */
async function createParents(run: Run, index: number, destinationPath: string): Promise<void> {
  const missing: string[] = [];
  for await (const folder of oneAtATime(parentFolders(destinationPath))) {
    if ((await run.files.idAt(folder)) !== undefined) {
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

/** Settles a LINK that couldn't link straight away, from what is on the disk. */
async function linkFromDisk(
  run: Run,
  index: number,
  destinationPath: string,
  stagedPath: string,
): Promise<void> {
  const { files } = run;
  const destinationId = await files.idAt(destinationPath);
  if (destinationId !== undefined) {
    if (destinationId === (await files.idAt(stagedPath))) {
      return;
    }
    await run.writer.recordRemovedFolder(index);
    run.removedFolders.add(index);
    await files.removeEmptyFolder(destinationPath);
    if ((await files.idAt(destinationPath)) !== undefined) {
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
    case OperationKind.Backup:
      if ((await files.idAt(destinationPath)) !== undefined) {
        await files.move(destinationPath, keptPathIn(entry));
      }
      return;
    case OperationKind.Unlink: {
      const keptPath = keptPathIn(entry);
      const destinationId = await files.idAt(destinationPath);
      if (destinationId === undefined) {
        // kept already, when a kill came between the move and its mark
        if ((await files.idAt(keptPath)) !== undefined) {
          run.kept.add(index);
        }
        return;
      }
      if (stagedPath !== undefined && (await files.idAt(stagedPath)) === destinationId) {
        await files.remove(destinationPath);
        return;
      }
      try {
        await files.move(destinationPath, keptPath);
      } catch {
        // a missing folder; a real failure recurs
        await createParents(run, index, keptPath);
        await files.move(destinationPath, keptPath);
      }
      run.kept.add(index);
      return;
    }
    case OperationKind.Restore: {
      const keptPath = keptPathIn(entry);
      if ((await files.idAt(keptPath)) !== undefined) {
        await files.move(keptPath, destinationPath);
      }
      return;
    }
    case OperationKind.Link: {
      if (stagedPath === undefined) {
        throw new Error(`no staged file to link at ${destinationPath}`);
      }
      try {
        await files.link(stagedPath, destinationPath);
      } catch {
        // a taken destination or a missing folder; a real failure recurs
        await linkFromDisk(run, index, destinationPath, stagedPath);
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
      const destinationId = await files.idAt(destinationPath);
      if (destinationId === undefined) {
        return;
      }
      if (stagedPath !== undefined && destinationId === (await files.idAt(stagedPath))) {
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
      const keptPath = keptPathIn(entry);
      if (
        (await files.idAt(keptPath)) === undefined &&
        (await files.idAt(destinationPath)) !== undefined
      ) {
        await files.move(destinationPath, keptPath);
      }
      return;
    }
    case OperationKind.Unlink: {
      const keptPath = keptPathIn(entry);
      if ((await files.idAt(keptPath)) !== undefined) {
        await files.move(keptPath, destinationPath);
      } else if (stagedPath !== undefined && (await files.idAt(destinationPath)) === undefined) {
        await files.link(stagedPath, destinationPath);
      }
      return;
    }
    case OperationKind.Backup: {
      const keptPath = keptPathIn(entry);
      if ((await files.idAt(keptPath)) !== undefined) {
        await files.move(keptPath, destinationPath);
      }
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
    if ((await run.files.idAt(folder)) === undefined) {
      await run.files.createFolder(folder);
    }
  }
}

const keptFiles = (run: Run): KeptFile[] =>
  run.entries.flatMap((entry, index) =>
    entry.operation.kind === OperationKind.Unlink && run.kept.has(index)
      ? [{ destinationPath: entry.operation.file.destinationPath, keptPath: keptPathIn(entry) }]
      : [],
  );

/** Undoes the run newest first, from the entry in doubt; the journal goes last. */
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

  const firstNotDone = run.entries.findIndex((_, index) => !run.done.has(index));
  const ran = firstNotDone === -1 ? run.entries : run.entries.slice(0, firstNotDone + 1);
  for await (const [index, entry] of oneAtATime([...ran.entries()].toReversed())) {
    if (run.undone.has(index)) {
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
    const kept = keptFiles(run);
    await run.writer.finish();
    return { status: ApplyStatus.Applied, kept };
  } catch (cause) {
    return { status: ApplyStatus.Unfinished, cause };
  }
}

const runOf = (files: ApplyFiles, writer: JournalWriter, journal: Omit<Journal, "runId">): Run => ({
  files,
  writer,
  entries: journal.entries,
  phase: journal.phase,
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
  let entries: JournalEntry[] | RefusedResult;
  try {
    entries = await entriesFor(operations, options, runId);
  } catch (cause) {
    return refused(RefusalReason.FilesUnavailable, { cause });
  }
  if (!Array.isArray(entries)) {
    return entries;
  }

  let writer: JournalWriter;
  try {
    writer = await createJournal(options.journal, entries, runId);
  } catch (cause) {
    return refused(RefusalReason.JournalUnavailable, { cause });
  }
  const run = runOf(options.files, writer, {
    entries,
    phase: JournalPhase.Applying,
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
