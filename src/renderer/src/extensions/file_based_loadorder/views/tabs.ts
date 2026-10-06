import type { IRegisteredLoadOrder } from "../types/types";

// The selected load order while the game registers it, else the game's first.
export function resolveActiveLoadOrderId(
  entries: readonly IRegisteredLoadOrder[],
  selectedLoadOrderId: string | undefined,
): string | undefined {
  if (entries.some((entry) => entry.loadOrderId === selectedLoadOrderId)) {
    return selectedLoadOrderId;
  }
  return entries[0]?.loadOrderId;
}
