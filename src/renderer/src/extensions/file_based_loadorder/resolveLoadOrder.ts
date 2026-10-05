import type { LoadOrder } from "./types/types";

// A game reports nothing both when it has nothing ordered and when its read failed, so the
// persisted order wins that tie.
export function loadOrderToPersist(
  stored: LoadOrder | undefined,
  deserialized: LoadOrder | undefined,
): LoadOrder {
  if (deserialized === undefined || deserialized.length === 0) {
    return stored ?? [];
  }
  return deserialized;
}
