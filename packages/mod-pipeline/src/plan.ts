import type { FileSource, Lockfile } from "./lockfile";

/** How the Apply step brings one destination in line with the lockfile. */
export const OperationKind = {
  Hardlink: "HARDLINK",
  Symlink: "SYMLINK",
  SymlinkElevated: "SYMLINK_ELEVATED",
  Copy: "COPY",
  Patch: "PATCH",
  Delete: "DELETE",
} as const;
export type OperationKind = (typeof OperationKind)[keyof typeof OperationKind];

/** One step of a plan: what to do at the destination of a lockfile file. */
export interface Operation {
  kind: OperationKind;
  /** the current lockfile's file, or the previous lockfile's for a Delete */
  destinationSource: FileSource;
}

/**
 * The operations that move disk from the previous lockfile to the current one,
 * a three way merge of both lockfiles and the disk state. Only Copy and Delete
 * are planned for now.
 */
export function plan(currentLockfile: Lockfile, previousLockfile: Lockfile): Operation[] {
  throw new Error("plan is not implemented yet");
}
