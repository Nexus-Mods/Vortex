import {
  FileSourceKind,
  KeptReason,
  OperationKind,
  parentFolders,
  type FileSource,
  type Operation,
} from "@nexusmods/mod-pipeline";
import { VortexError } from "@vortex/shared";
import { QualifiedPath, type FileSystem, type StatResult } from "@vortex/shared/filesystem";

import { entryIdOf } from "../diskScan";
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

/** Where Stage keeps a lockfile's files. */
export interface StagedFiles {
  pathOf(file: FileSource): string | undefined;
}

export interface RunOptions {
  fs: FileSystem;
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

const qualified = (path: string) => QualifiedPath.fromNative(path);

const statusAt = (fs: FileSystem, path: string) => fs.stat(qualified(path), { parseSymLink: true });

/** The id of what a status describes, shared by a file's hardlinks. */
const idOf = (status: StatResult) => (status.exists ? entryIdOf(status) : undefined);

const idAt = async (fs: FileSystem, path: string) => idOf(await statusAt(fs, path));

/** The status of `folder`, or of the nearest folder above it that exists. */
async function existingFolderAt(fs: FileSystem, folder: QualifiedPath): Promise<StatResult> {
  const status = await fs.stat(folder, { parseSymLink: true });
  return status.exists || folder.path === folder.root
    ? status
    : existingFolderAt(fs, folder.parent());
}

/** Fails when `to` is taken or on another drive. */
async function moveOnDrive(fs: FileSystem, from: string, to: string): Promise<void> {
  const [source, targetFolder] = await Promise.all([
    statusAt(fs, from),
    existingFolderAt(fs, qualified(to).parent()),
  ]);
  // FileSystem.move copies across drives, which a kill can leave half done
  if (source.exists && targetFolder.exists && source.deviceId !== targetFolder.deviceId) {
    throw new VortexError(`${to} is on another drive than ${from}`, {
      kind: "os:generic",
      originalCode: "EXDEV",
    });
  }
  await fs.move(qualified(from), qualified(to));
}

/** Does nothing when the folder is missing or holds anything, or a file is there. */
async function removeEmptyFolder(fs: FileSystem, path: string): Promise<void> {
  const status = await statusAt(fs, path);
  if (!status.exists || status.isFile) {
    return;
  }
  const folder = qualified(path);
  const listing = await fs.enumerateDirectory(folder);
  const { done } = await listing.next();
  await listing.return?.();
  if (done === true) {
    await fs.deleteRecursive(folder);
  }
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
  fs: FileSystem;
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
  for (const folder of parentFolders(destinationPath)) {
    if ((await idAt(run.fs, folder)) !== undefined) {
      break;
    }
    missing.push(folder);
  }
  const [deepest] = missing;
  if (deepest === undefined) {
    return;
  }
  for (const folder of missing) {
    await run.writer.recordFolder(index, folder);
    addFolder(run.createdFolders, index, folder);
  }
  await run.fs.createDirectory(qualified(deepest));
}

/** Moves a file, making and recording any missing folders. */
async function moveInto(run: Run, index: number, from: string, to: string): Promise<void> {
  try {
    await moveOnDrive(run.fs, from, to);
  } catch {
    // a missing folder; a real failure recurs
    await createParents(run, index, to);
    await moveOnDrive(run.fs, from, to);
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
    if ((await idAt(run.fs, keptPath)) !== undefined) {
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
  fs: FileSystem,
  destinationId: string | undefined,
  stagedPath: string | undefined,
) =>
  destinationId !== undefined &&
  stagedPath !== undefined &&
  destinationId === (await idAt(fs, stagedPath));

/** Settles a LINK that couldn't link straight away, from what was at its destination. */
async function linkFromDisk(
  run: Run,
  index: number,
  destinationPath: string,
  stagedPath: string,
  destinationId: string | undefined,
): Promise<void> {
  const { fs } = run;
  if (destinationId !== undefined) {
    await run.writer.recordRemovedFolder(index);
    run.removedFolders.add(index);
    await removeEmptyFolder(fs, destinationPath);
    if ((await idAt(fs, destinationPath)) !== undefined) {
      throw new Error(`something else is at ${destinationPath}`);
    }
  }
  await createParents(run, index, destinationPath);
  await fs.createLink(qualified(stagedPath), qualified(destinationPath), "hardlink");
}

/** Runs one entry, checking the disk first, so it is safe to repeat. */
async function applyEntry(run: Run, index: number, entry: JournalEntry): Promise<void> {
  const { fs } = run;
  const { operation, stagedPath } = entry;
  const destinationPath = destinationOf(operation);
  switch (operation.kind) {
    case OperationKind.Backup: {
      const destination = await statusAt(fs, destinationPath);
      if (entry.keptPath !== undefined) {
        await setAside(run, index, destinationPath, idOf(destination), entry.keptPath);
        return;
      }
      if (!destination.exists) {
        return;
      }
      // a file linked elsewhere isn't the game's original
      if (destination.hardlinkCount !== 1) {
        throw new Error(`${destinationPath} has another hardlink, so it isn't the game's original`);
      }
      await markChanging(run, index);
      await moveInto(run, index, destinationPath, backupPathIn(entry));
      return;
    }
    case OperationKind.Unlink: {
      const destinationId = await idAt(fs, destinationPath);
      if (await isStagedFile(fs, destinationId, stagedPath)) {
        await markChanging(run, index);
        await fs.delete(qualified(destinationPath));
        return;
      }
      await setAside(run, index, destinationPath, destinationId, keptPathIn(entry));
      return;
    }
    case OperationKind.Restore: {
      const backupPath = backupPathIn(entry);
      if ((await idAt(fs, backupPath)) !== undefined) {
        await markChanging(run, index);
        await moveOnDrive(fs, backupPath, destinationPath);
      }
      return;
    }
    case OperationKind.Link: {
      if (stagedPath === undefined) {
        throw new Error(`no staged file to link at ${destinationPath}`);
      }
      const destinationId = await idAt(fs, destinationPath);
      if (await isStagedFile(fs, destinationId, stagedPath)) {
        return;
      }
      await markChanging(run, index);
      try {
        await fs.createLink(qualified(stagedPath), qualified(destinationPath), "hardlink");
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
  const { fs } = run;
  const { operation, stagedPath } = entry;
  const destinationPath = destinationOf(operation);
  switch (operation.kind) {
    case OperationKind.Link: {
      const destinationId = await idAt(fs, destinationPath);
      if (destinationId === undefined) {
        return;
      }
      if (await isStagedFile(fs, destinationId, stagedPath)) {
        await fs.delete(qualified(destinationPath));
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
        (await idAt(fs, backupPath)) === undefined &&
        (await idAt(fs, destinationPath)) !== undefined
      ) {
        await moveOnDrive(fs, destinationPath, backupPath);
      }
      return;
    }
    case OperationKind.Unlink: {
      const keptPath = keptPathIn(entry);
      if ((await idAt(fs, keptPath)) !== undefined) {
        await moveOnDrive(fs, keptPath, destinationPath);
      } else if (stagedPath !== undefined && (await idAt(fs, destinationPath)) === undefined) {
        await fs.createLink(qualified(stagedPath), qualified(destinationPath), "hardlink");
      }
      return;
    }
    case OperationKind.Backup: {
      const movedTo = entry.keptPath ?? backupPathIn(entry);
      if ((await idAt(fs, movedTo)) === undefined) {
        return;
      }
      // it never moved, so what is at its backup name isn't its file
      if (!run.done.has(index) && (await idAt(fs, destinationPath)) !== undefined) {
        return;
      }
      await moveOnDrive(fs, movedTo, destinationPath);
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
    for (const folder of created) {
      await removeEmptyFolder(run.fs, folder);
    }
  }
  if (run.removedFolders.has(index)) {
    const folder = destinationOf(entry.operation);
    if ((await idAt(run.fs, folder)) === undefined) {
      await run.fs.createDirectory(qualified(folder));
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

  for (const [index, entry] of [...run.entries.entries()].toReversed()) {
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
  for (const [index, entry] of run.entries.entries()) {
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

const runOf = (fs: FileSystem, writer: JournalWriter, journal: Omit<Journal, "runId">): Run => ({
  fs,
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
  const run = runOf(options.fs, writer, {
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
  { fs, journal }: RunOptions,
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
    run = runOf(fs, await continueJournal(journal, read), read.journal);
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
