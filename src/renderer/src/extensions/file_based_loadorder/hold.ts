import type { IMod } from "../mod_management/types/IMod";
import type { IHeldLoadOrder } from "./reducers/session";
import type { ILoadOrderEntry, LoadOrder } from "./types/types";

// The Vortex mod an entry belongs to; games that set no modId key their entries by the mod id.
export const vortexModIdOf = (entry: ILoadOrderEntry): string => entry.modId ?? entry.id;

// A replacement hold awaits the replaced mods; a purge hold awaits nothing and waits for the
// deployment itself.
export const holdAwaitsMods = (held: IHeldLoadOrder): boolean =>
  held.awaitedVortexModIds.length > 0;

// Whether a held order can be restored into a load order the game reported: every awaited mod is
// listed in it again.
export function holdCanRestore(held: IHeldLoadOrder, fromGame: LoadOrder): boolean {
  const listed = new Set(fromGame.map(vortexModIdOf));
  return held.awaitedVortexModIds.every((vortexModId) => listed.has(vortexModId));
}

// An awaited mod is missing from Vortex: its replacement never landed, so the hold ends.
export function holdIsStale(
  held: IHeldLoadOrder,
  modsByVortexModId: Record<string, IMod>,
): boolean {
  return held.awaitedVortexModIds.some(
    (vortexModId) => modsByVortexModId[vortexModId] === undefined,
  );
}
