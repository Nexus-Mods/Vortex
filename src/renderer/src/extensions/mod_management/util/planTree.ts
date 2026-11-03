import {
  DestinationState,
  FileSourceKind,
  OperationKind,
  pathKeyOf,
  type FileSource,
  type NexusFileId,
  type PlannedDestination,
} from "@nexusmods/mod-pipeline";

/** Operations by kind. */
export type PlanOperationCounts = Record<OperationKind, number>;

/** A folder of a plan, with every destination under it. */
export interface IPlanFolder {
  /** "/" separated, as the first destination under it spells it */
  path: string;
  /** relative to the folder above it; a folder holding only one folder is joined to it */
  name: string;
  folders: IPlanFolder[];
  files: PlannedDestination[];
  /** the destinations under it, at any depth */
  fileCount: number;
  /** the operations under it, at any depth */
  operationCounts: PlanOperationCounts;
}

export const PlanRowKind = {
  Folder: "folder",
  File: "file",
} as const;
export type PlanRowKind = (typeof PlanRowKind)[keyof typeof PlanRowKind];

/** A row of the plan's table, `depth` folders below the top one; `id` keys it in the table. */
export type PlanRow =
  | { kind: typeof PlanRowKind.Folder; id: string; folder: IPlanFolder; depth: number }
  | { kind: typeof PlanRowKind.File; id: string; destination: PlannedDestination; depth: number };

/** What the plan's table shows; an empty set or text lets every destination through. */
export interface IPlanFilter {
  operationKinds: ReadonlySet<OperationKind>;
  states: ReadonlySet<DestinationState>;
  /** a mod's Nexus file, as the current or the previous lockfile names it */
  nexusFileId: NexusFileId | undefined;
  pathText: string;
}

/** `values` with `value` added, or removed when it was there. */
export function toggledIn<T>(values: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(values);
  if (!next.delete(value)) {
    next.add(value);
  }
  return next;
}

export const isEmptyPlanFilter = ({
  operationKinds,
  states,
  nexusFileId,
  pathText,
}: IPlanFilter): boolean =>
  operationKinds.size === 0 && states.size === 0 && nexusFileId === undefined && pathText === "";

/** Each destination's path key, computed once per plan for the path filter. */
export const planPathKeys = (destinations: readonly PlannedDestination[]): string[] =>
  destinations.map(({ destinationPath }) => pathKeyOf(destinationPath));

/** The destinations a filter lets through; `pathKeys` are theirs, in the same order. */
export function filterPlan(
  destinations: readonly PlannedDestination[],
  pathKeys: readonly string[],
  { operationKinds, states, nexusFileId, pathText }: IPlanFilter,
): PlannedDestination[] {
  const pathTextKey = pathKeyOf(pathText);
  return destinations.filter(
    (destination, index) =>
      (states.size === 0 || states.has(destination.state)) &&
      (operationKinds.size === 0 ||
        destination.operations.some((operation) => operationKinds.has(operation.kind))) &&
      (nexusFileId === undefined ||
        [destination.current, destination.previous].some(
          (file) => file?.source === FileSourceKind.Nexus && file.nexusFileId === nexusFileId,
        )) &&
      pathKeys[index].includes(pathTextKey),
  );
}

interface IFolderNode {
  path: string;
  /** by the folder name's path key */
  folders: Map<string, IFolderNode>;
  /** by the folder name as spelled, so a spelling seen before skips the key */
  foldersByName: Map<string, IFolderNode>;
  files: PlannedDestination[];
}

const folderNode = (path: string): IFolderNode => ({
  path,
  folders: new Map(),
  foldersByName: new Map(),
  files: [],
});

function finishFolder(node: IFolderNode, parentPath: string | undefined): IPlanFolder {
  let folder = node;
  while (folder.files.length === 0 && folder.folders.size === 1) {
    [folder] = folder.folders.values();
  }
  const folders = [...folder.folders]
    .toSorted(([lhs], [rhs]) => (lhs < rhs ? -1 : 1))
    .map(([, child]) => finishFolder(child, folder.path));
  const operationCounts: PlanOperationCounts = {
    [OperationKind.Backup]: 0,
    [OperationKind.Link]: 0,
    [OperationKind.Unlink]: 0,
  };
  for (const operation of folder.files.flatMap((destination) => destination.operations)) {
    operationCounts[operation.kind] += 1;
  }
  for (const child of folders) {
    for (const kind of Object.values(OperationKind)) {
      operationCounts[kind] += child.operationCounts[kind];
    }
  }
  return {
    path: folder.path,
    name: parentPath === undefined ? folder.path : folder.path.slice(parentPath.length + 1),
    folders,
    files: folder.files,
    fileCount: folders.reduce((total, child) => total + child.fileCount, folder.files.length),
    operationCounts,
  };
}

/** The destinations by folder, from the deepest folder they all share; they keep their order. */
export function planTree(destinations: readonly PlannedDestination[]): IPlanFolder {
  const root = folderNode("");
  for (const destination of destinations) {
    const segments = destination.destinationPath.split("/").slice(0, -1);
    // an absolute "/" path starts with an empty segment, which the root stands for
    const rootPrefix = segments[0] === "" ? "/" : "";
    let node = root;
    for (const segment of rootPrefix === "/" ? segments.slice(1) : segments) {
      let child = node.foldersByName.get(segment);
      if (child === undefined) {
        const key = pathKeyOf(segment);
        child =
          node.folders.get(key) ??
          folderNode(node === root ? `${rootPrefix}${segment}` : `${node.path}/${segment}`);
        node.folders.set(key, child);
        node.foldersByName.set(segment, child);
      }
      node = child;
    }
    node.files.push(destination);
  }
  return finishFolder(root, undefined);
}

/** The folders that hold an operation, at any depth. */
export function defaultExpandedFolders(root: IPlanFolder): Set<string> {
  const expanded = new Set<string>();
  const visit = (folder: IPlanFolder) => {
    if (Object.values(folder.operationCounts).some((count) => count > 0)) {
      expanded.add(folder.path);
      folder.folders.forEach(visit);
    }
  };
  visit(root);
  return expanded;
}

/** The rows the table shows: each folder, then its folders and files while it is expanded. */
export function planRows(root: IPlanFolder, expanded: ReadonlySet<string>): PlanRow[] {
  const rows: PlanRow[] = [];
  const visit = (folder: IPlanFolder, depth: number) => {
    rows.push({ kind: PlanRowKind.Folder, id: `folder:${folder.path}`, folder, depth });
    if (!expanded.has(folder.path)) {
      return;
    }
    folder.folders.forEach((child) => visit(child, depth + 1));
    folder.files.forEach((destination) =>
      rows.push({
        kind: PlanRowKind.File,
        id: `file:${destination.destinationPath}`,
        destination,
        depth: depth + 1,
      }),
    );
  };
  visit(root, 0);
  return rows;
}

export function countByState(
  destinations: readonly PlannedDestination[],
): Map<DestinationState, number> {
  const counts = new Map<DestinationState, number>();
  for (const { state } of destinations) {
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }
  return counts;
}

const STATE_NAMES = new Map(Object.entries(DestinationState).map(([name, code]) => [code, name]));

/** A state's name in the planner's table, e.g. "DeployedUnhashed" for "DAA". */
export const destinationStateName = (state: DestinationState): string =>
  STATE_NAMES.get(state) ?? state;

/** A Nexus file with the name of the mod it belongs to. */
export const nexusFileLabel = (
  nexusFileId: NexusFileId,
  modNames: ReadonlyMap<NexusFileId, string>,
): string => `${modNames.get(nexusFileId) ?? "unknown mod"} (Nexus file ${nexusFileId})`;

/** Where a lockfile's file comes from, with its mod's name when it is a Nexus file. */
export function originLabel(
  file: FileSource | undefined,
  modNames: ReadonlyMap<NexusFileId, string>,
): string {
  if (file === undefined) {
    return "not in the lockfile";
  }
  switch (file.source) {
    case FileSourceKind.Nexus:
      return nexusFileLabel(file.nexusFileId, modNames);
    case FileSourceKind.VortexGenerated:
      return "generated by Vortex";
    case FileSourceKind.UserGenerated:
      return "user generated";
  }
  const exhausted: never = file;
  return exhausted;
}
