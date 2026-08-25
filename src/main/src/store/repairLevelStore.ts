/**
 * Rebuilds a leveldb store whose level index failed validation. The data is
 * intact on disk - a full scan reads every file through the merging iterator
 * and does not consult the index - so the repair is: scan everything out,
 * write it into a fresh store, swap the directories, and keep the original
 * beside it as evidence.
 */
import * as fs from "fs";
import * as path from "path";

import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../logging";
import DuckDBSingleton from "./DuckDBSingleton";
import { validateLevelLayout } from "./levelLayout";

export interface IRepairResult {
  repaired: boolean;
  rows: number;
  /** rows dropped because the same key appeared more than once in the scan */
  duplicates: number;
}

const NOT_REPAIRED: IRepairResult = { repaired: false, rows: 0, duplicates: 0 };

// bounded positional-parameter count per INSERT, matching importBackup
const CHUNK_SIZE = 256;

// The repair attaches under its own alias names and never draws from
// nextAlias: the query system's SQL references the catalog "db" literally,
// which nextAlias only yields for the first draw, so the store's real attach
// after the repair has to still be that first draw.
const SOURCE_ALIAS = "repair_source";
const TARGET_ALIAS = "repair_target";

async function readAllRows(
  dbPath: string,
): Promise<{ rows: Map<string, string | null>; duplicates: number }> {
  const singleton = DuckDBSingleton.getInstance();
  const alias = SOURCE_ALIAS;
  const connection = await singleton.attachDatabase(dbPath, alias);
  try {
    const reader = await connection.runAndReadAll(`SELECT key, value FROM ${alias}.kv`);
    // key -> value; with a broken index the shadowing between duplicate
    // versions of a key is not trustworthy, so last-seen wins and the count
    // is reported rather than silently absorbed
    const rows = new Map<string, string | null>();
    let duplicates = 0;
    for (const row of reader.getRows()) {
      const key = row[0] as string;
      if (rows.has(key)) {
        duplicates += 1;
      }
      rows.set(key, row[1] as string | null);
    }
    return { rows, duplicates };
  } finally {
    await singleton.detachDatabase(alias);
  }
}

async function writeAllRows(dbPath: string, rows: Map<string, string | null>): Promise<void> {
  const singleton = DuckDBSingleton.getInstance();
  const alias = TARGET_ALIAS;
  // attachDatabase registers the kv table on the fresh store itself
  const connection = await singleton.attachDatabase(dbPath, alias);
  try {
    const entries = [...rows.entries()];
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = entries.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map((_row, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`);
      await connection.run(
        `INSERT INTO ${alias}.kv VALUES ${placeholders.join(", ")}`,
        chunk.flat(),
      );
    }
  } finally {
    await singleton.detachDatabase(alias);
  }
}

/**
 * Scan-read the store at `dbPath`, rewrite it into a fresh store, and swap the
 * two. The original is renamed to `<dbPath>.corrupt-<timestamp>` and kept. On
 * any failure the original store is left exactly where it was.
 */
export async function repairLevelStore(
  dbPath: string,
  extensionDir: string,
): Promise<IRepairResult> {
  const stamp = Date.now();
  const rebuiltPath = `${dbPath}.repair-${stamp}`;
  const preservedPath = `${dbPath}.corrupt-${stamp}`;

  // never create the store we are about to read: the attach would conjure an
  // empty one and the repair would then persist that emptiness
  if (!fs.existsSync(path.join(dbPath, "CURRENT"))) {
    log("error", "repair requested for a store that does not exist", { dbPath });
    return NOT_REPAIRED;
  }

  try {
    const singleton = DuckDBSingleton.getInstance();
    await singleton.initialize(extensionDir);

    const { rows, duplicates } = await readAllRows(dbPath);
    if (rows.size === 0) {
      // an empty read of a store that failed validation means the data is not
      // reachable even by scan - rewriting would persist the loss
      log("error", "repair scan returned no rows, leaving store untouched", { dbPath });
      return NOT_REPAIRED;
    }

    await writeAllRows(rebuiltPath, rows);

    const layout = validateLevelLayout(rebuiltPath);
    if (!layout.ok) {
      throw new Error(`rebuilt store failed validation: ${layout.problems.join(", ")}`);
    }

    fs.renameSync(dbPath, preservedPath);
    try {
      fs.renameSync(rebuiltPath, dbPath);
    } catch (err) {
      // put the original back rather than leave no store at all
      fs.renameSync(preservedPath, dbPath);
      throw err;
    }

    log("info", "state store rebuilt", {
      dbPath,
      rows: rows.size,
      preserved: path.basename(preservedPath),
    });
    if (duplicates > 0) {
      log("warn", "repair scan returned duplicate keys, kept last-seen", { duplicates });
    }
    return { repaired: true, rows: rows.size, duplicates };
  } catch (err) {
    log("error", "state store repair failed, leaving store untouched", {
      dbPath,
      error: getErrorMessageOrDefault(err),
    });
    try {
      fs.rmSync(rebuiltPath, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
    return NOT_REPAIRED;
  }
}
