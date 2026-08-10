import type { ILoadOrderEntry, LoadOrder } from "./types/types";

export interface ILoadOrderDiffOptions {
  // fileId of the mod currently backing this entry (from state)
  currentFileId: (entry: ILoadOrderEntry) => number | undefined;
  // fileId recorded for this entry before the change (from the update set)
  storedFileId: (entry: ILoadOrderEntry) => number | undefined;
}

export interface ILoadOrderDiff {
  // ids present in next but not prev
  added: string[];
  // ids present in prev but not next
  removed: string[];
  // ids unchanged in id, position and enabled state
  same: string[];
  // a mod backing an in-place entry changed file, so the order needs restoring
  shouldRestore: boolean;
}

/**
 * Classify how a load order changed. An entry counts as "same" only when its id
 * sits at the same index in both orders and its enabled state is unchanged; a
 * differing backing fileId at the same position instead flags a restore.
 */
export function diffLoadOrder(
  prev: LoadOrder,
  next: LoadOrder,
  options: ILoadOrderDiffOptions,
): ILoadOrderDiff {
  const prevIds = prev.map((lo) => lo.id);
  const nextIds = next.map((lo) => lo.id);
  // Map of entry id to its index in the previous order
  const prevIdIndices = new Map(prevIds.map((id, idx): [string, number] => [id, idx]));
  const nextIdSet = new Set(nextIds);

  const added = nextIds.filter((id) => !prevIdIndices.has(id));
  const removed = prevIds.filter((id) => !nextIdSet.has(id));

  let shouldRestore = false;
  const same: string[] = [];
  next.forEach((lo, idx) => {
    if (prevIdIndices.get(lo.id) !== idx) {
      return;
    }
    const currentFileId = options.currentFileId(lo);
    const storedFileId = options.storedFileId(lo) ?? -1;
    if (currentFileId && currentFileId !== storedFileId) {
      shouldRestore = true;
      return;
    }
    if (lo.enabled !== prev[idx].enabled) {
      return;
    }
    same.push(lo.id);
  });

  return { added, removed, same, shouldRestore };
}
