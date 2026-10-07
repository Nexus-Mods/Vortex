import type { LoadOrder } from "./types/types";

export interface ILoadOrderDiff {
  // ids present in next but not prev
  added: string[];
  // ids present in prev but not next
  removed: string[];
  // ids unchanged in id, position and enabled state
  same: string[];
}

/**
 * Classify how a load order changed. An entry counts as "same" only when its id
 * sits at the same index in both orders and its enabled state is unchanged.
 */
export function diffLoadOrder(prev: LoadOrder, next: LoadOrder): ILoadOrderDiff {
  const prevIds = prev.map((lo) => lo.id);
  const nextIds = next.map((lo) => lo.id);
  // Map of entry id to its index in the previous order
  const prevIdIndices = new Map(prevIds.map((id, idx): [string, number] => [id, idx]));
  const nextIdSet = new Set(nextIds);

  const added = nextIds.filter((id) => !prevIdIndices.has(id));
  const removed = prevIds.filter((id) => !nextIdSet.has(id));

  const same: string[] = [];
  next.forEach((lo, idx) => {
    if (prevIdIndices.get(lo.id) !== idx) {
      return;
    }
    if (lo.enabled !== prev[idx].enabled) {
      return;
    }
    same.push(lo.id);
  });

  return { added, removed, same };
}
