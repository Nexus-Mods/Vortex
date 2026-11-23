import {
  FileSourceKind,
  KeptReason,
  OperationKind,
  parentFolders,
  type FileSource,
  type Operation,
} from "@nexusmods/mod-pipeline";
import { getErrorMessageOrDefault, VortexError } from "@vortex/shared";
import { QualifiedPath, type FileSystem, type StatResult } from "@vortex/shared/filesystem";

import { log } from "../../../../logging";
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
  type ManifestSaveDetails,
  type RemovedFolder,
} from "./journal";

/** Where Stage keeps a lockfile's files. */
export interface StagedFiles {
  pathOf(file: FileSource): string | undefined;
}

/** The file that marks a folder as made by a deployment, for it to be removed once empty. */
export interface FolderTag {
  name: string;
  contents: string;
}

export interface RunOptions {
  fs: FileSystem;
  journal: JournalStorage;
  /**
   * records what the run deployed, once every step ran and before its journal ends, with the
   * manifest update its journal holds; a resumed run calls it again, so it is safe to repeat
   */
  recordDeployment?: (
    entries: readonly JournalEntry[],
    manifestSaveDetails: ManifestSaveDetails | undefined,
  ) => Promise<void>;
  /**
   * the tag the run gives the folders a LINK makes; without it they are untagged and no folder the
   * run empties is removed
   */
  folderTag?: FolderTag;
}

export interface ApplyOptions extends RunOptions {
  stagedFiles: StagedFiles;
  /** kept in its journal, for recordDeployment */
  manifestSaveDetails?: ManifestSaveDetails;
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
/** Every step ran, but the deployment couldn't be recorded or the journal written or ended; {@link resumeApply} finishes it. */
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

/** The names of a folder's first two entries, or undefined when no folder is there. */
async function firstTwoEntryNames(fs: FileSystem, path: string): Promise<string[] | undefined> {
  const status = await statusAt(fs, path);
  if (!status.exists || status.isFile) {
    return undefined;
  }
  const names: string[] = [];
  for await (const entry of await fs.enumerateDirectory(qualified(path))) {
    names.push(entry.basename);
    if (names.length === 2) {
      break;
    }
  }
  return names;
}

/** Whether a folder's entries are no more than the tag. */
const isEmptyButForTag = (names: readonly string[], folderTag: FolderTag | undefined) =>
  names.every((name) => name === folderTag?.name);

/** Removes a folder holding nothing, or nothing but `folderTag`; leaves anything else. */
async function removeFolderIfEmpty(fs: FileSystem, path: string, folderTag?: FolderTag) {
  const names = await firstTwoEntryNames(fs, path);
  if (names !== undefined && isEmptyButForTag(names, folderTag)) {
    await fs.deleteRecursive(qualified(path));
  }
}

/** Writes the tag into a folder that is there and lacks it. */
async function writeTagIfMissing(fs: FileSystem, folder: string, folderTag: FolderTag) {
  const tagPath = qualified(folder).join(folderTag.name);
  const folderStatus = await statusAt(fs, folder);
  if (
    folderStatus.exists &&
    !folderStatus.isFile &&
    !(await fs.stat(tagPath, { parseSymLink: true })).exists
  ) {
    await fs.writeFile(tagPath, new TextEncoder().encode(folderTag.contents));
  }
}

export const destinationOf = (operation: Operation) =>
  "file" in operation ? operation.file.destinationPath : operation.destinationPath;

const refused = (reason: RefusalReason, details: Partial<RefusedResult> = {}): RefusedResult => ({
  status: ApplyStatus.Refused,
  reason,
  ...details,
});

/** A run's state, kept as its journal records it. */
interface Run {
  fs: FileSystem;
  folderTag: FolderTag | undefined;
  manifestSaveDetails: ManifestSaveDetails | undefined;
  recordDeployment: RunOptions["recordDeployment"];
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
  /** in the order the run removed them */
  removedFolders: RemovedFolder[];
}

/** Whether the LINK at `index` may have removed an empty folder at its destination. */
const linkRemovedAFolder = (run: Run, index: number) =>
  run.removedFolders.some((folder) => "index" in folder && folder.index === index);

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
    await run.writer.recordRemovedFolder({ index });
    run.removedFolders.push({ index });
    await removeFolderIfEmpty(fs, destinationPath);
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
      if (!(await isStagedFile(fs, destinationId, stagedPath))) {
        await markChanging(run, index);
        try {
          await fs.createLink(qualified(stagedPath), qualified(destinationPath), "hardlink");
        } catch {
          // a taken destination or a missing folder; a real failure recurs
          await linkFromDisk(run, index, destinationPath, stagedPath, destinationId);
        }
      }
      // also when the link is already there, for a run killed before its folders were tagged
      const { folderTag } = run;
      if (folderTag !== undefined) {
        for (const folder of run.createdFolders.get(index) ?? []) {
          await writeTagIfMissing(fs, folder, folderTag);
        }
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
        !linkRemovedAFolder(run, index)
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
      await removeFolderIfEmpty(run.fs, folder, run.folderTag);
    }
  }
  if (linkRemovedAFolder(run, index)) {
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

/** Logs a folder the run leaves although its steps emptied it. */
const warnFolderStays = (message: string, folder: string, err: unknown) =>
  log("warn", message, { folder, error: getErrorMessageOrDefault(err) });

/**
 * Removes the tagged folders the run's UNLINKs and BACKUPs left holding only their tag, deepest
 * first, recording each first. A folder whose listing or removal fails stays, tagged where it can
 * be, with the folders above it; a failure to record ends the run unfinished.
 */
async function removeEmptiedTaggedFolders(run: Run): Promise<void> {
  const { folderTag } = run;
  if (folderTag === undefined) {
    return;
  }
  const foldersAboveRemovedFiles = new Set<string>();
  const aboveAFolderThatStays = new Set<string>();
  const keepFoldersAbove = (path: string) => {
    for (const folder of parentFolders(path)) {
      aboveAFolderThatStays.add(folder);
    }
  };
  for (const { operation } of run.entries) {
    const destinationPath = destinationOf(operation);
    if (operation.kind === OperationKind.Unlink || operation.kind === OperationKind.Backup) {
      for (const folder of parentFolders(destinationPath)) {
        if (foldersAboveRemovedFiles.has(folder)) {
          break;
        }
        foldersAboveRemovedFiles.add(folder);
      }
    } else {
      // a LINK or RESTORE leaves a file there
      keepFoldersAbove(destinationPath);
    }
  }
  const recordedAsRemoved = new Set(
    run.removedFolders.flatMap((folder) => ("path" in folder ? [folder.path] : [])),
  );
  // a folder's path is longer than its parent's, so a parent is decided after its children
  for (const folder of [...foldersAboveRemovedFiles].toSorted(
    (lhs, rhs) => rhs.length - lhs.length,
  )) {
    if (aboveAFolderThatStays.has(folder)) {
      continue;
    }
    let names: string[] | undefined;
    try {
      names = await firstTwoEntryNames(run.fs, folder);
    } catch (err) {
      warnFolderStays("couldn't list a folder the deployment emptied", folder, err);
      keepFoldersAbove(folder);
      continue;
    }
    if (names === undefined) {
      continue;
    }
    // a recorded folder may have lost its tag to a kill before it was removed
    if (
      !isEmptyButForTag(names, folderTag) ||
      (names.length === 0 && !recordedAsRemoved.has(folder))
    ) {
      keepFoldersAbove(folder);
      continue;
    }
    if (!recordedAsRemoved.has(folder)) {
      await run.writer.recordRemovedFolder({ path: folder });
      run.removedFolders.push({ path: folder });
    }
    try {
      await run.fs.deleteRecursive(qualified(folder));
    } catch (err) {
      warnFolderStays("couldn't remove a folder the deployment emptied", folder, err);
      // a purge removes it later if it keeps its tag
      await writeTagIfMissing(run.fs, folder, folderTag).catch((tagErr: unknown) =>
        warnFolderStays("couldn't tag a folder the deployment emptied", folder, tagErr),
      );
      keepFoldersAbove(folder);
    }
  }
}

/** Puts back the tagged folders the run removed, the last removed first, tagged where it can be. */
async function restoreRemovedTaggedFolders(run: Run): Promise<void> {
  const { folderTag } = run;
  if (folderTag === undefined) {
    return;
  }
  for (const removed of run.removedFolders.toReversed()) {
    if (!("path" in removed)) {
      continue;
    }
    if ((await idAt(run.fs, removed.path)) === undefined) {
      await run.fs.createDirectory(qualified(removed.path));
    }
    await writeTagIfMissing(run.fs, removed.path, folderTag).catch((err: unknown) =>
      warnFolderStays("couldn't tag a folder a rollback put back", removed.path, err),
    );
  }
}

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
    // before any step is undone, so a file put back has its folder
    await restoreRemovedTaggedFolders(run);
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
    await run.recordDeployment?.(run.entries, run.manifestSaveDetails);
    await removeEmptiedTaggedFolders(run);
    await run.writer.finish();
    return { status: ApplyStatus.Applied, kept: keptFiles(run) };
  } catch (cause) {
    return { status: ApplyStatus.Unfinished, cause };
  }
}

const runOf = (
  { fs, recordDeployment, folderTag }: RunOptions,
  writer: JournalWriter,
  journal: Omit<Journal, "runId">,
): Run => ({
  fs,
  folderTag,
  manifestSaveDetails: journal.manifestSaveDetails,
  recordDeployment,
  writer,
  entries: journal.entries,
  phase: journal.phase,
  changing: new Set(journal.changing),
  done: new Set(journal.done),
  kept: new Set(journal.kept),
  undone: journal.undone,
  createdFolders: foldersByEntry(journal.createdFolders),
  removedFolders: [...journal.removedFolders],
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

  const headerDetails = { manifestSaveDetails: options.manifestSaveDetails };
  let writer: JournalWriter | undefined;
  try {
    writer = await createJournal(options.journal, entries, runId, headerDetails);
  } catch (cause) {
    return refused(RefusalReason.JournalUnavailable, { cause });
  }
  // another run can create its journal between the read above and this one
  if (writer === undefined) {
    return refused(RefusalReason.JournalExists);
  }
  const run = runOf(options, writer, {
    ...headerDetails,
    entries,
    phase: JournalPhase.Applying,
    changing: new Set(),
    done: new Set(),
    kept: new Set(),
    undone: new Set(),
    createdFolders: [],
    removedFolders: [],
  });
  return closingAfter(writer, () => runForward(run));
}

/** Runs `work` on the run a journal left. */
async function settle<R>(
  options: RunOptions,
  work: (run: Run) => Promise<R>,
): Promise<R | RefusedResult | NothingToDoResult> {
  let run: Run;
  try {
    const read = await readJournal(options.journal);
    if (read.status === JournalReadStatus.None) {
      return { status: ApplyStatus.NothingToDo };
    }
    if (read.status === JournalReadStatus.Invalid) {
      return refused(RefusalReason.JournalUnavailable);
    }
    run = runOf(options, await continueJournal(options.journal, read), read.journal);
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
