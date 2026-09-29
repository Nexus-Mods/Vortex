/**
 * Priority assignment for mods.settings, kept free of imports so it can be unit
 * tested without the Vortex API.
 *
 * The game orders mod folders by the Priority value, so two mods sharing one
 * number leaves their relative order down to however the file happens to be
 * enumerated. Priorities therefore have to be unique across the whole file.
 */

/** A mod as it appears in the ini: either a bare folder name or a managed mod. */
export type ModSettingsEntry = string | { name: string; id: string };

export interface IPriorityInput {
  /** Every mod that should appear in the file, in the order they were gathered. */
  mods: ModSettingsEntry[];
  /** Folder names pinned to the top, in the order they should hold. */
  locked: string[];
  /** Folder names in the order the user arranged them. */
  loadOrderIds: string[];
}

export interface IPriorityResult {
  name: string;
  key: string;
  priority: number;
}

export const nameOf = (mod: ModSettingsEntry): string =>
  typeof mod === "object" && mod !== null ? mod.name : mod;

const keyOf = (mod: ModSettingsEntry): string =>
  typeof mod === "object" && mod !== null ? mod.id : mod;

/**
 * Locked mods keep the top of the range in their given order, mods the user has
 * arranged follow in that order, and anything the load order doesn't know about
 * is appended. Every mod gets a distinct priority.
 *
 * Mods whose folder name begins with `dlc` are dropped: they are mounted from
 * the DLC directory and the game rejects them here.
 */
export function assignPriorities(input: IPriorityInput): IPriorityResult[] {
  const { mods, locked, loadOrderIds } = input;

  const relevant = mods.filter((mod) => !nameOf(mod).toLowerCase().startsWith("dlc"));

  const rank = (name: string): number => {
    const lockedAt = locked.indexOf(name);
    if (lockedAt !== -1) {
      return lockedAt;
    }
    const orderedAt = loadOrderIds.indexOf(name);
    if (orderedAt !== -1) {
      return locked.length + orderedAt;
    }
    // Unknown to the load order: appended, never collapsed onto one priority.
    return locked.length + loadOrderIds.length;
  };

  const seen = new Set<string>();
  const deduped = relevant.filter((mod) => {
    const name = nameOf(mod);
    if (seen.has(name)) {
      return false;
    }
    seen.add(name);
    return true;
  });

  // A stable sort keeps the gathered order within each rank, so the unknown
  // bucket stays in a predictable sequence.
  return deduped
    .map((mod, idx) => ({ mod, idx, rank: rank(nameOf(mod)) }))
    .sort((lhs, rhs) => lhs.rank - rhs.rank || lhs.idx - rhs.idx)
    .map((item, position) => ({
      name: nameOf(item.mod),
      key: keyOf(item.mod),
      priority: position + 1,
    }));
}
