import { getErrorMessageOrDefault } from "@vortex/shared";
import { isClobberedKeySegment } from "@vortex/shared/state";

import { log } from "../logging";
import type LevelPersist from "./LevelPersist";

const isCorrupt = (key: string[]): boolean => key.some(isClobberedKeySegment);

// The shallowest prefix we will ever delete. A depth-1 prefix is a whole hive
// (e.g. `persistent`), so deleting it — even with a re-insert of the survivors —
// would put the entire modding environment through a destructive rebuild. If the
// only clean prefix we can form is that shallow, refuse and leave the key: a
// lingering corrupt key is recoverable, a wiped hive is not.
const MIN_HEAL_PREFIX_DEPTH = 2;

export interface HealResult {
  /** number of corrupt (clobbered) keys dropped */
  removed: number;
  /** number of valid sibling rows rewritten to preserve them */
  rewritten: number;
  /** the clean prefixes whose subtree was rebuilt (dotted, for logging) */
  prefixes: string[];
  /** corrupt keys we refused to heal because the only clean prefix was too shallow */
  skipped: string[][];
}

/**
 * Remove persisted keys whose bytes are not valid UTF-8.
 *
 * Such a key reads back through the VARCHAR key column as a lossy,
 * U+FFFD/control-char string; re-encoding that string yields different bytes
 * than are on disk, so an exact-key delete can never match it and it lingers,
 * re-triggering state repair on every launch.
 *
 * It can still be removed via a delete keyed on a CLEAN prefix (the segments
 * before the first clobbered one), which matches the key's intact leading bytes
 * at the byte level. The corrupt key shares that prefix with its valid siblings,
 * so we drop the subtree and re-insert the siblings, losing only the corrupt one.
 *
 * Safety: never deletes a prefix shallower than `MIN_HEAL_PREFIX_DEPTH`, so a
 * heal can never wipe a whole hive; wrapped in a transaction so a failure rolls
 * back rather than leaving a half-cleared subtree.
 *
 * Runs in the main process before hydration, so the renderer never sees the
 * corruption. Best-effort: callers must not let a failure here block startup.
 * (LAZ-788)
 */
export async function healInvalidKeys(persist: LevelPersist): Promise<HealResult> {
  const result: HealResult = { removed: 0, rewritten: 0, prefixes: [], skipped: [] };

  const corruptKeys = (await persist.getAllKeys()).filter(isCorrupt);
  if (corruptKeys.length === 0) {
    return result;
  }

  // The clean prefix is the segments before the first clobbered one, so its
  // length equals that segment's index. Dedupe: sibling corrupt keys share it.
  const prefixes = new Map<string, string[]>();
  for (const key of corruptKeys) {
    const idx = key.findIndex(isClobberedKeySegment);
    if (idx < MIN_HEAL_PREFIX_DEPTH) {
      result.skipped.push(key);
      continue;
    }
    const prefix = key.slice(0, idx);
    prefixes.set(JSON.stringify(prefix), prefix);
  }

  if (result.skipped.length > 0) {
    log(
      "warn",
      "state heal: refusing to heal corrupt key(s) — clean prefix would be a whole hive",
      {
        count: result.skipped.length,
        // segment 0 is safe to log — it is the intact hive name
        hives: [...new Set(result.skipped.map((k) => k[0]))],
      },
    );
  }

  if (prefixes.size === 0) {
    return result;
  }

  // Load values once so the valid siblings can be re-inserted after the drop.
  const allKVs = await persist.getAllKVs();

  await persist.beginTransaction();
  try {
    for (const prefix of prefixes.values()) {
      const underPrefix = allKVs.filter(
        (kv) => kv.key.length > prefix.length && prefix.every((seg, i) => kv.key[i] === seg),
      );
      const good = underPrefix.filter((kv) => !isCorrupt(kv.key));

      await persist.removeItem(prefix);
      if (good.length > 0) {
        await persist.bulkSetItem(good);
      }

      result.removed += underPrefix.length - good.length;
      result.rewritten += good.length;
      result.prefixes.push(prefix.join("."));
    }
    await persist.commitTransaction();
  } catch (err) {
    await persist.rollbackTransaction();
    throw new Error(`state heal failed: ${getErrorMessageOrDefault(err)}`, { cause: err });
  }

  log("info", "state heal: removed unrepairable keys", {
    removed: result.removed,
    rewritten: result.rewritten,
    prefixes: result.prefixes,
    skipped: result.skipped.length,
  });

  return result;
}
