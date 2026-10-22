import type { DiskEntry, DiskScan } from "./diskScan";
import {
  FileSourceKind,
  FileSourceSchema,
  type FileOrigin,
  type FileSource,
  type Lockfile,
  type StagedFile,
} from "./lockfile";
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

/**
 * The operations each destination needs, keyed by its state written Disk, Previous, Current:
 * - `x`: nothing there
 * - `A`: the current file, or the previous one when the current lockfile has none
 * - `B`: the previous file, when its content or origin differs from the current one
 * - `C`: content neither lockfile has
 * - `?` (disk only): an entry the scan did not hash
 *
 * Every LINK lands on an empty destination: whatever is there is unlinked when it is ours, and
 * backed up otherwise, so Apply never writes through a hardlink into a staged file.
 */
const ACTIONS: Readonly<Record<string, readonly OperationKind[]>> = {
  xxA: [OperationKind.Link], // a new file
  AxA: [OperationKind.Backup, OperationKind.Link], // the same content, but not ours to take over
  BxA: [OperationKind.Backup, OperationKind.Link], // another file is in the way
  "?xA": [OperationKind.Backup, OperationKind.Link], // an unknown file is in the way
  xAA: [OperationKind.Link], // our file is gone
  AAA: [], // nothing changed
  BAA: [OperationKind.Backup, OperationKind.Link], // our file was changed outside the pipeline
  "?AA": [], // trusted to be what we deployed
  xBA: [OperationKind.Link], // the update's older file is gone
  ABA: [OperationKind.Backup, OperationKind.Link], // the update's content, but not placed by us
  BBA: [OperationKind.Unlink, OperationKind.Link], // an update over our older file
  CBA: [OperationKind.Backup, OperationKind.Link], // our older file was changed outside the pipeline
  "?BA": [OperationKind.Unlink, OperationKind.Link], // trusted to be our older file
  xAx: [], // a removed file is already gone
  AAx: [OperationKind.Unlink], // a removed file
  BAx: [OperationKind.Backup], // a removed file was changed outside the pipeline
  "?Ax": [OperationKind.Unlink], // trusted to be the removed file
};

const sameContent = (
  lhs: Pick<StagedFile, "fileHash" | "hashType">,
  rhs: Pick<StagedFile, "fileHash" | "hashType">,
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

/** A destination's state, the key into ACTIONS. */
function stateOf(
  entry: DiskEntry | undefined,
  previous: FileSource | undefined,
  current: FileSource | undefined,
): string {
  const currentLetter = current !== undefined ? "A" : "x";
  let previousLetter = "x";
  if (previous !== undefined) {
    previousLetter = current === undefined || sameFile(previous, current) ? "A" : "B";
  }
  if (entry === undefined) {
    return `x${previousLetter}${currentLetter}`;
  }
  if (entry.contentHash === undefined) {
    return `?${previousLetter}${currentLetter}`;
  }
  // content matching our previous file counts as that file, so an origin change still relinks
  if (previous !== undefined && sameContent(entry.contentHash, previous)) {
    return `${previousLetter}${previousLetter}${currentLetter}`;
  }
  if (current !== undefined && sameContent(entry.contentHash, current)) {
    return `A${previousLetter}${currentLetter}`;
  }
  return `${previousLetter === "B" ? "C" : "B"}${previousLetter}${currentLetter}`;
}

// an empty, "." or ".." segment, or a "\" or ":" anywhere
const INVALID_RELATIVE_PATH = /(^|\/)\.{0,2}(\/|$)|[\\:]/;

/** A lockfile's files by destination; throws when it lists one twice. */
function filesByDestination(files: readonly FileSource[]): Map<string, FileSource> {
  const fileByDestination = new Map(files.map((file) => [file.destinationPath, file]));
  if (fileByDestination.size !== files.length) {
    throw new Error("a lockfile lists a destination twice");
  }
  return fileByDestination;
}

/** Throws on a destination outside the scanned folders and on an unsorted scan. */
function checkInputs(destinations: readonly string[], disk: DiskScan): void {
  const rootPrefixes = disk.roots.map((root) => (root.endsWith("/") ? root : `${root}/`));
  for (const destinationPath of destinations) {
    const covered = rootPrefixes.some(
      (prefix) =>
        destinationPath.startsWith(prefix) &&
        !INVALID_RELATIVE_PATH.test(destinationPath.slice(prefix.length)),
    );
    if (!covered) {
      throw new Error(`${destinationPath} is not a valid path under a scanned folder`);
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
 * folders. `leftOnDisk` holds the disk paths the plan does not clear first.
 */
function checkFolders(
  currentByPath: ReadonlyMap<string, FileSource>,
  leftOnDisk: ReadonlySet<string>,
): void {
  for (const destinationPath of currentByPath.keys()) {
    for (const folder of parentFolders(destinationPath)) {
      if (currentByPath.has(folder)) {
        throw new Error(`${destinationPath} is inside ${folder}, another destination`);
      }
      if (leftOnDisk.has(folder)) {
        throw new Error(`${folder} is a file or link on disk where a folder is needed`);
      }
    }
  }
  for (const path of leftOnDisk) {
    for (const folder of parentFolders(path)) {
      if (currentByPath.has(folder)) {
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
  const currentByPath = filesByDestination(current.files);
  const previousByPath = filesByDestination(previous?.files ?? []);
  const destinations = [...new Set([...currentByPath.keys(), ...previousByPath.keys()])].toSorted();
  checkInputs(destinations, disk);
  const diskByPath = new Map(disk.entries.map((entry) => [entry.path, entry]));

  const operations = destinations.flatMap((destinationPath) => {
    const currentFile = currentByPath.get(destinationPath);
    const previousFile = previousByPath.get(destinationPath);
    const state = stateOf(diskByPath.get(destinationPath), previousFile, currentFile);
    const kinds = ACTIONS[state];
    if (kinds === undefined) {
      throw new Error(`no plan for ${destinationPath} in state ${state}`);
    }
    return kinds.map((kind) => operationOf(kind, destinationPath, currentFile, previousFile));
  });
  // a path no current file uses is empty once its operations ran
  const cleared = new Set(operations.map(destinationOf).filter((path) => !currentByPath.has(path)));
  checkFolders(currentByPath, new Set([...diskByPath.keys()].filter((path) => !cleared.has(path))));
  return [
    ...operations.filter((operation) => operation.kind !== OperationKind.Link),
    ...operations.filter((operation) => operation.kind === OperationKind.Link),
  ];
}
