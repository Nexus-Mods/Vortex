/**
 * Load order priority arithmetic, kept free of imports so it can be unit
 * tested without pulling in the Vortex API.
 */

/** Only the fields the priority calculation reads. */
interface IPriorityEntry {
  pos: number;
  prefix?: string;
  data?: { prefix?: string };
}

/**
 * Highest priority currently in use, so a newly added mod can be placed after
 * it. Entries carry their prefix under `data`; the flat form is what load
 * orders persisted by older versions look like.
 */
export function maxPriorityFrom(loadOrder: ArrayLike<IPriorityEntry>, minPriority: number): number {
  return Object.keys(loadOrder).reduce((prev, key) => {
    const entry = loadOrder[key];
    const prefixVal = entry?.data?.prefix ?? entry?.prefix;
    const intVal = prefixVal !== undefined ? parseInt(prefixVal, 10) : entry.pos;
    const posVal = entry.pos;
    if (posVal !== intVal) {
      return intVal > prev ? intVal : prev;
    }
    return posVal > prev ? posVal : prev;
  }, minPriority);
}
