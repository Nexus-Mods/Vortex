import type { IMod } from "../mod_management/types/IMod";
import { loadOrderToPersist } from "./resolveLoadOrder";
import type { ILoadOrderEntry, LoadOrder } from "./types/types";
import { isEntryLocked } from "./util";

// A key linking an entry to the stored entry it continues; undefined when the entry lacks the data.
type ContinuityKeyOf = (entry: ILoadOrderEntry) => string | undefined;

// The id a continuity key pairs with the entry name.
const ContinuityKeyKind = {
  VortexMod: "vortex-mod",
  NexusFile: "nexus-file",
  NexusMod: "nexus-mod",
} as const;
type ContinuityKeyKind = (typeof ContinuityKeyKind)[keyof typeof ContinuityKeyKind];

// Older mods store their Nexus ids as strings; both forms build the same key.
function continuityKey(
  kind: ContinuityKeyKind,
  id: number | string | undefined,
  entryName: string,
): string | undefined {
  return id == null || id === "" ? undefined : `${kind}\u0000${id}\u0000${entryName}`;
}

/**
 * The ways a freshly read entry can continue a stored one after its id changed, tried in order:
 * the same Vortex mod (an update or a reinstall from the same download keeps the Vortex mod id),
 * the same Nexus file (that file back under a new Vortex mod id), the same Nexus mod (a newer
 * version installed by hand). Each pairs the mod with the entry's name, since one mod can ship
 * several entries. Entries without a mod, and mods with no Nexus metadata, match by id only.
 */
function continuityKeys(modsByVortexModId: Record<string, IMod>): ContinuityKeyOf[] {
  const attributesOf = (entry: ILoadOrderEntry) =>
    entry.modId === undefined ? undefined : modsByVortexModId[entry.modId]?.attributes;
  return [
    (entry) => continuityKey(ContinuityKeyKind.VortexMod, entry.modId, entry.name),
    (entry) => continuityKey(ContinuityKeyKind.NexusFile, attributesOf(entry)?.fileId, entry.name),
    (entry) => continuityKey(ContinuityKeyKind.NexusMod, attributesOf(entry)?.modId, entry.name),
  ];
}

function countByKey(loadOrder: LoadOrder, keyOf: ContinuityKeyOf): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of loadOrder) {
    const key = keyOf(entry);
    if (key !== undefined) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * The stored index an entry continues by one key, used only when exactly one stored and one fresh
 * entry share it. Two installs of one mod page, or two variants of one file, can ship same-named
 * entries; a guess there would hand one install's position to another.
 */
function uniqueKeyMatch(
  stored: LoadOrder,
  fromGame: LoadOrder,
  keyOf: ContinuityKeyOf,
): (entry: ILoadOrderEntry) => number | undefined {
  const storedCounts = countByKey(stored, keyOf);
  const freshCounts = countByKey(fromGame, keyOf);
  const storedIndexByKey = new Map<string, number>();
  stored.forEach((entry, storedIndex) => {
    const key = keyOf(entry);
    if (key !== undefined) {
      storedIndexByKey.set(key, storedIndex);
    }
  });
  return (entry) => {
    const key = keyOf(entry);
    if (key === undefined || storedCounts.get(key) !== 1 || freshCounts.get(key) !== 1) {
      return undefined;
    }
    return storedIndexByKey.get(key);
  };
}

// The stored entry a freshly read one continues: the same entry id, else the first continuity key
// that matches. Unmanaged and native entries have only their id, which games set to the file name.
function storedIndexOf(
  stored: LoadOrder,
  fromGame: LoadOrder,
  modsByVortexModId: Record<string, IMod>,
): (entry: ILoadOrderEntry) => number | undefined {
  const storedIndexByEntryId = new Map(stored.map((entry, storedIndex) => [entry.id, storedIndex]));
  const keyMatches = continuityKeys(modsByVortexModId).map((keyOf) =>
    uniqueKeyMatch(stored, fromGame, keyOf),
  );
  return (entry) => {
    const sameEntry = storedIndexByEntryId.get(entry.id);
    if (sameEntry !== undefined) {
      return sameEntry;
    }
    for (const keyMatch of keyMatches) {
      const storedIndex = keyMatch(entry);
      if (storedIndex !== undefined) {
        return storedIndex;
      }
    }
    return undefined;
  };
}

/**
 * The game's entries in the stored order where the game reports a stored entry. New entries keep
 * the slot the game gave them, stored entries absent from the report drop out, locked entries keep
 * the game's slot. A game that reports nothing gets the stored order back, since an empty read and
 * a failed read look the same. `modsByVortexModId` is the game's mods, as `modsForGame` returns
 * them.
 */
export function reconcileLoadOrder(
  stored: LoadOrder | undefined,
  fromGame: LoadOrder | undefined,
  modsByVortexModId: Record<string, IMod>,
): LoadOrder {
  if (!fromGame?.length || !stored?.length) {
    return loadOrderToPersist(stored, fromGame);
  }
  const storedIndexFor = storedIndexOf(stored, fromGame, modsByVortexModId);
  // unlocked entries the game reports that continue a stored one, with the game's slot
  const continued = fromGame
    .map((entry, gameSlot) => ({ entry, gameSlot, storedIndex: storedIndexFor(entry) }))
    .filter(
      (item): item is { entry: ILoadOrderEntry; gameSlot: number; storedIndex: number } =>
        item.storedIndex !== undefined && !isEntryLocked(item.entry.locked),
    );
  const continuedInStoredOrder = [...continued].sort(
    (lhs, rhs) => lhs.storedIndex - rhs.storedIndex,
  );
  // the continued entries take the slots they occupy among themselves, in stored order
  const reconciled = [...fromGame];
  continued.forEach(({ gameSlot }, rank) => {
    reconciled[gameSlot] = continuedInStoredOrder[rank].entry;
  });
  return reconciled;
}
