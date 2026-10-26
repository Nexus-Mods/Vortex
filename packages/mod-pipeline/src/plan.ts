import type { DiskEntry, DiskScan } from "./diskScan";
import {
  FileSourceKind,
  FileSourceSchema,
  type FileOrigin,
  type FileSource,
  type Lockfile,
  type FileEntry,
} from "./lockfile";
import { pathKeyOf } from "./pathKey";
import type { Assert, MutuallyAssignable } from "./typeChecks";
import { z } from "./zodJitless";

/** What the Apply step does at one destination; Apply picks the deployment method. */
export const OperationKind = {
  Backup: "BACKUP",
  Link: "LINK",
  Unlink: "UNLINK",
} as const;
export type OperationKind = (typeof OperationKind)[keyof typeof OperationKind];

/** One step of a plan. */
export type Operation =
  /** moves the file at the destination aside */
  | { kind: typeof OperationKind.Backup; destinationPath: string }
  /** deploys the current lockfile's file to its destination */
  | { kind: typeof OperationKind.Link; file: FileSource }
  /** removes the previous lockfile's file from its destination */
  | { kind: typeof OperationKind.Unlink; file: FileSource };

const operationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal(OperationKind.Backup), destinationPath: z.string() }),
  z.object({ kind: z.literal(OperationKind.Link), file: FileSourceSchema }),
  z.object({ kind: z.literal(OperationKind.Unlink), file: FileSourceSchema }),
]);

// typecheck fails when the schema and its type drift apart
type _OperationMatches = Assert<MutuallyAssignable<z.infer<typeof operationSchema>, Operation>>;

export const OperationSchema: z.ZodType<Operation> = operationSchema;

type DiskLetter = "x" | "A" | "B" | "C" | "D";

/**
 * Every reachable state of a destination. Each value is its code, written Disk, Previous, Current:
 * - `x`: nothing there
 * - `A`: the current file, or the previous one when the current lockfile has none
 * - `B`: the previous file, when its content or origin differs from the current one
 * - `C`: content neither lockfile has
 * - `D` (disk only): an entry the scan did not hash
 */
const DestinationState = {
  NewFile: "xxA",
  NewOverIdentical: "AxA",
  NewOverOther: "BxA",
  NewOverUnhashed: "DxA",
  DeployedMissing: "xAA",
  Unchanged: "AAA",
  DeployedEdited: "BAA",
  DeployedUnhashed: "DAA",
  UpdatedMissing: "xBA",
  UpdatedOverIdentical: "ABA",
  Updated: "BBA",
  UpdatedOverEdited: "CBA",
  UpdatedOverUnhashed: "DBA",
  RemovedMissing: "xAx",
  Removed: "AAx",
  RemovedEdited: "BAx",
  RemovedUnhashed: "DAx",
} as const satisfies Record<string, `${DiskLetter}${"x" | "A" | "B"}${"x" | "A"}`>;
type DestinationState = (typeof DestinationState)[keyof typeof DestinationState];

/**
 * The operations each state needs; typecheck fails on a missing or extra row. Every
 * LINK lands on an empty destination: whatever is there is unlinked when it is ours, and backed up
 * otherwise, so Apply never writes through a hardlink into a staged file.
 */
const OPERATIONS_BY_STATE = {
  [DestinationState.NewFile]: [OperationKind.Link],
  // the same content, but not ours to take over
  [DestinationState.NewOverIdentical]: [OperationKind.Backup, OperationKind.Link],
  [DestinationState.NewOverOther]: [OperationKind.Backup, OperationKind.Link],
  [DestinationState.NewOverUnhashed]: [OperationKind.Backup, OperationKind.Link],
  [DestinationState.DeployedMissing]: [OperationKind.Link],
  [DestinationState.Unchanged]: [],
  [DestinationState.DeployedEdited]: [OperationKind.Backup, OperationKind.Link],
  // trusted to be what we deployed
  [DestinationState.DeployedUnhashed]: [],
  [DestinationState.UpdatedMissing]: [OperationKind.Link],
  // the update's content, but not placed by us
  [DestinationState.UpdatedOverIdentical]: [OperationKind.Backup, OperationKind.Link],
  [DestinationState.Updated]: [OperationKind.Unlink, OperationKind.Link],
  [DestinationState.UpdatedOverEdited]: [OperationKind.Backup, OperationKind.Link],
  // trusted to be our older file
  [DestinationState.UpdatedOverUnhashed]: [OperationKind.Unlink, OperationKind.Link],
  [DestinationState.RemovedMissing]: [],
  [DestinationState.Removed]: [OperationKind.Unlink],
  [DestinationState.RemovedEdited]: [OperationKind.Backup],
  // trusted to be the removed file
  [DestinationState.RemovedUnhashed]: [OperationKind.Unlink],
} as const satisfies Record<DestinationState, readonly OperationKind[]>;

const sameContent = (
  lhs: Pick<FileEntry, "fileHash" | "hashType">,
  rhs: Pick<FileEntry, "fileHash" | "hashType">,
) => lhs.hashType === rhs.hashType && lhs.fileHash === rhs.fileHash;

function sameOrigin(lhs: FileOrigin, rhs: FileOrigin): boolean {
  switch (lhs.source) {
    case FileSourceKind.Nexus:
      return rhs.source === FileSourceKind.Nexus && lhs.fileUid === rhs.fileUid;
    case FileSourceKind.VortexGenerated:
    case FileSourceKind.UserGenerated:
      return rhs.source === lhs.source;
  }
  const exhausted: never = lhs;
  return exhausted;
}

// the same bytes from another mod still relink, so a symlink never points into a purged mod
const sameFile = (lhs: FileSource, rhs: FileSource) =>
  sameContent(lhs, rhs) && sameOrigin(lhs, rhs);

/** The current and previous lockfile's file at one destination; at least one is there. */
type LockfileFilesAt =
  | { current: FileSource; previous: FileSource | undefined }
  | { current: undefined; previous: FileSource };

// operations keep the lockfile's own spelling of a path
const destinationPathOf = (files: LockfileFilesAt) =>
  files.current !== undefined ? files.current.destinationPath : files.previous.destinationPath;

/** The disk entry's letter compared with `file`. */
function diskLetterAgainst(
  entry: DiskEntry | undefined,
  file: FileSource,
): Exclude<DiskLetter, "C"> {
  if (entry === undefined) {
    return "x";
  }
  if (entry.contentHash === undefined) {
    return "D";
  }
  return sameContent(entry.contentHash, file) ? "A" : "B";
}

/** A destination's state; typecheck fails if it can produce one OPERATIONS_BY_STATE lacks. */
function destinationStateOf(
  entry: DiskEntry | undefined,
  { current, previous }: LockfileFilesAt,
): DestinationState {
  if (current === undefined) {
    return `${diskLetterAgainst(entry, previous)}Ax`;
  }
  if (previous === undefined) {
    return `${diskLetterAgainst(entry, current)}xA`;
  }
  if (sameFile(previous, current)) {
    return `${diskLetterAgainst(entry, current)}AA`;
  }
  if (entry === undefined) {
    return DestinationState.UpdatedMissing;
  }
  if (entry.contentHash === undefined) {
    return DestinationState.UpdatedOverUnhashed;
  }
  // content matching our older file counts as that file, so an origin change still relinks
  if (sameContent(entry.contentHash, previous)) {
    return DestinationState.Updated;
  }
  return sameContent(entry.contentHash, current)
    ? DestinationState.UpdatedOverIdentical
    : DestinationState.UpdatedOverEdited;
}

// an empty, "." or ".." segment, or a "\" or ":" anywhere
const INVALID_RELATIVE_PATH = /(^|\/)\.{0,2}(\/|$)|[\\:]/;

/** A lockfile's files by path key; throws when it lists one destination twice. */
function filesByKey(files: readonly FileSource[]): Map<string, FileSource> {
  const fileByKey = new Map(files.map((file) => [pathKeyOf(file.destinationPath), file]));
  if (fileByKey.size !== files.length) {
    throw new Error("a lockfile lists a destination twice");
  }
  return fileByKey;
}

/** Throws on a destination outside the scanned folders and on an unsorted scan. */
function checkInputs(destinations: ReadonlyArray<[string, LockfileFilesAt]>, disk: DiskScan): void {
  const rootPrefixes = disk.roots.map((root) => pathKeyOf(root.endsWith("/") ? root : `${root}/`));
  for (const [destinationKey, files] of destinations) {
    const covered = rootPrefixes.some(
      (prefix) =>
        destinationKey.startsWith(prefix) &&
        !INVALID_RELATIVE_PATH.test(destinationKey.slice(prefix.length)),
    );
    if (!covered) {
      throw new Error(`${destinationPathOf(files)} is not a valid path under a scanned folder`);
    }
  }
  disk.entries.forEach((entry, index) => {
    const before = disk.entries[index - 1];
    if (before !== undefined && before.path >= entry.path) {
      throw new Error(`the disk scan is not sorted by path at ${entry.path}`);
    }
  });
}

/** Each folder above a path, nearest first. */
function parentFolders(path: string): string[] {
  const folders: string[] = [];
  for (let end = path.lastIndexOf("/"); end > 0; end = path.lastIndexOf("/", end - 1)) {
    folders.push(path.slice(0, end));
  }
  return folders;
}

/**
 * Throws where a current file and something else need the same path as a file and as a folder:
 * another destination, an entry on disk, or a link that would take Apply outside the scanned
 * folders. Both maps are keyed by path key; `leftOnDisk` is what the plan leaves on disk. Paths
 * are reported as the lockfile or the disk spells them.
 */
function checkFolders(
  currentByKey: ReadonlyMap<string, FileSource>,
  leftOnDisk: ReadonlyMap<string, DiskEntry>,
): void {
  for (const { destinationPath } of currentByKey.values()) {
    for (const folder of parentFolders(destinationPath)) {
      if (currentByKey.has(pathKeyOf(folder))) {
        throw new Error(`${destinationPath} is inside ${folder}, another destination`);
      }
      if (leftOnDisk.has(pathKeyOf(folder))) {
        throw new Error(`${folder} is a file or link on disk where a folder is needed`);
      }
    }
  }
  for (const entry of leftOnDisk.values()) {
    for (const folder of parentFolders(entry.path)) {
      if (currentByKey.has(pathKeyOf(folder))) {
        throw new Error(`${folder} is a folder on disk`);
      }
    }
  }
}

const destinationOf = (operation: Operation) =>
  operation.kind === OperationKind.Backup
    ? operation.destinationPath
    : operation.file.destinationPath;

function operationOf(
  kind: OperationKind,
  destinationPath: string,
  current: FileSource | undefined,
  previous: FileSource | undefined,
): Operation {
  switch (kind) {
    case OperationKind.Backup:
      return { kind, destinationPath };
    case OperationKind.Link:
      if (current === undefined) {
        throw new Error(`no current file to link at ${destinationPath}`);
      }
      return { kind, file: current };
    case OperationKind.Unlink:
      if (previous === undefined) {
        throw new Error(`no previous file to unlink at ${destinationPath}`);
      }
      return { kind, file: previous };
  }
  const exhausted: never = kind;
  return exhausted;
}

/**
 * The operations that bring the disk from the previous lockfile to the current one, a three way
 * merge of both lockfiles and the disk scan. No previous lockfile is a first run. BACKUP and
 * UNLINK come first, then LINK, each in destination order, so a file can replace a folder of
 * ours and a folder can replace a file of ours.
 */
export function plan(
  current: Lockfile,
  previous: Lockfile | undefined,
  disk: DiskScan,
): Operation[] {
  if (previous !== undefined && previous.gameId !== current.gameId) {
    throw new Error(`the lockfiles are for games ${previous.gameId} and ${current.gameId}`);
  }
  const currentByKey = filesByKey(current.files);
  const previousByKey = filesByKey(previous?.files ?? []);
  const filesByDestinationKey = new Map<string, LockfileFilesAt>();
  for (const [key, previousFile] of previousByKey) {
    filesByDestinationKey.set(key, { current: undefined, previous: previousFile });
  }
  for (const [key, currentFile] of currentByKey) {
    filesByDestinationKey.set(key, { current: currentFile, previous: previousByKey.get(key) });
  }
  const destinations = [...filesByDestinationKey].toSorted(([lhs], [rhs]) => (lhs < rhs ? -1 : 1));
  checkInputs(destinations, disk);
  const diskByKey = new Map(disk.entries.map((entry) => [pathKeyOf(entry.path), entry]));

  const operations = destinations.flatMap(([key, files]) =>
    OPERATIONS_BY_STATE[destinationStateOf(diskByKey.get(key), files)].map((kind) =>
      operationOf(kind, destinationPathOf(files), files.current, files.previous),
    ),
  );
  // a path no current file uses is empty once its operations ran
  const cleared = new Set(
    operations
      .map((operation) => pathKeyOf(destinationOf(operation)))
      .filter((key) => !currentByKey.has(key)),
  );
  checkFolders(currentByKey, new Map([...diskByKey].filter(([key]) => !cleared.has(key))));
  return [
    ...operations.filter((operation) => operation.kind !== OperationKind.Link),
    ...operations.filter((operation) => operation.kind === OperationKind.Link),
  ];
}
