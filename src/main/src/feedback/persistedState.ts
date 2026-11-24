import { setImmediate as yieldToLoop } from "node:timers/promises";

import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../logging";
import { dropPaths, keyPatternFor, TRIMMED_PATHS, type StatePath } from "./trimState";

/** One stored leaf of a persisted hive: its path below the hive, and its value as JSON text. */
export interface IPersistedRow {
  key: string[];
  value: string;
}

/**
 * Reads a persisted hive's rows, leaving out the keys `exclude` matches without reading their
 * values (`readPersistedRows` in `src/main/src/store/mainPersistence.ts`).
 */
export type ReadPersistedRows = (hive: string, exclude: string) => Promise<IPersistedRow[]>;

/**
 * The hives a feedback sends that main persists, and so reads itself rather than having the
 * renderer serialise them and send them over. The same as a support bundle's (`BACKUP_HIVES`).
 */
export const FEEDBACK_PERSISTED_HIVES = ["settings", "persistent", "app", "user"] as const;

/**
 * The login details a feedback never carries, which `scrubState` takes out of the state the
 * renderer exports. Main reads the persisted hives itself, so it leaves them out the same way:
 * by key as it reads, and again from the state it builds, for a value stored as one object above
 * them, which the key pattern doesn't match.
 */
const SCRUBBED_PATHS: readonly StatePath[] = [["persistent", "nexus", "userInfo", "email"]];

/**
 * The keys of `hive` a feedback leaves out as main reads it, without reading their values: what
 * it trims (`TRIMMED_PATHS`) and what it scrubs. `trimFeedbackState` still runs on what is read,
 * for the trims that depend on a value and for a value stored in another shape.
 */
export const excludedKeyPattern = (hive: string): string =>
  keyPatternFor(hive, [...TRIMMED_PATHS, ...SCRUBBED_PATHS]);

/** A stored value: JSON text, kept as text where it does not parse, as hydration reads it. */
function parseValue(text: string): unknown {
  if (text.length === 0) return "";
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

type Node = Record<string, unknown>;

/**
 * Objects without a prototype, so a stored key named `__proto__` is a plain key like any other
 * rather than a way to change what the objects built here inherit.
 */
const newNode = (): Node => Object.create(null) as Node;

const isNode = (value: unknown): value is Node =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function insertLeaf(root: Node, key: readonly string[], value: unknown): void {
  if (key.length === 0) return;
  let node = root;
  for (const segment of key.slice(0, -1)) {
    let next = node[segment];
    if (!isNode(next)) {
      next = newNode();
      node[segment] = next;
    }
    node = next as Node;
  }
  node[key[key.length - 1]!] = value;
}

/**
 * The persisted hives a feedback sends, read from where main stores them, redacted, and without
 * the keys a feedback leaves out. Each value is redacted as JSON text, as the whole export was
 * when the renderer sent it as one text; a key is redacted too, since a key can hold a path. A hive
 * that can't be read is left out, and the event loop gets a turn between hives.
 */
export async function readPersistedFeedbackState(
  read: ReadPersistedRows,
  redact: (text: string) => string,
): Promise<Record<string, unknown>> {
  const state: Record<string, unknown> = {};
  for (const hive of FEEDBACK_PERSISTED_HIVES) {
    try {
      const rows = await read(hive, excludedKeyPattern(hive));
      const value = newNode();
      for (const row of rows) {
        insertLeaf(value, row.key.map(redact), parseValue(redact(row.value)));
      }
      state[hive] = value;
    } catch (err) {
      log("warn", "failed to read persisted state hive for feedback", {
        hive,
        error: getErrorMessageOrDefault(err),
      });
    }
    await yieldToLoop();
  }
  dropPaths(state, SCRUBBED_PATHS);
  return state;
}
