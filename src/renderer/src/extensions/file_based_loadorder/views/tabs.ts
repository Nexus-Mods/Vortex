import { isPrimaryLoadOrderId } from "../registry";
import type { IRegisteredLoadOrder } from "../types/types";

// An unnamed load order's placeholder id means nothing to the extension that registered it.
export function headerActionInstanceId(shownLoadOrderId: string | undefined): string | undefined {
  return isPrimaryLoadOrderId(shownLoadOrderId) ? undefined : shownLoadOrderId;
}

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
