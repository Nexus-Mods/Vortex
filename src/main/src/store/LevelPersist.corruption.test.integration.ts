/**
 * Reproduces the unremovable-key defect (LAZ-788): a persisted key whose bytes
 * are not valid UTF-8 cannot be deleted through the normal key-based path. The
 * key is stored VARCHAR, so it reads back lossily as U+FFFD and a delete built
 * from that decoded string no longer matches the bytes on disk.
 *
 * Runs against the real level_pivot extension over a real LevelDB store; the
 * corrupt key is injected at the byte level with `leveldown`, then read and
 * deleted through `LevelPersist` as the persistence layer does.
 *
 * Requires the extension binary: `pnpm --filter @vortex/main run
 * download-duckdb-extensions`.
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import DuckDBSingleton from "./DuckDBSingleton";
import LevelPersist from "./LevelPersist";

const require = createRequire(import.meta.url);
// leveldown ships no reliable ESM types; treat as a raw LevelDB byte store.
const leveldown = require("leveldown") as (dbPath: string) => LevelDown;

interface LevelDown {
  open(opts: { createIfMissing: boolean }, cb: (err?: Error) => void): void;
  put(key: Buffer, value: Buffer, cb: (err?: Error) => void): void;
  close(cb: (err?: Error) => void): void;
}

const EXT_DIR = path.resolve(import.meta.dirname, "../../build/duckdb-extensions");
const PLATFORM = process.platform === "win32" ? "windows_amd64" : "linux_amd64";

// A download key with its middle bytes mangled: 0xFF bytes (never valid UTF-8
// lead bytes) decode to U+FFFD on a VARCHAR read, so re-encoding the read-back
// string no longer matches the stored bytes.
const FILES_PREFIX = "persistent###downloads###files###";
const HEALTHY_ID = "Y-To2XJTA";
const CORRUPT_KEY = Buffer.concat([
  Buffer.from(`${FILES_PREFIX}Y-T`),
  Buffer.from([0xff, 0xff, 0xff, 0xff]),
  Buffer.from("TA###size"),
]);
const HEALTHY_KEY = Buffer.from(`${FILES_PREFIX}${HEALTHY_ID}###size`);
const VALUE = Buffer.from("112105");

function injectRawKeys(dbPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = leveldown(dbPath);
    db.open({ createIfMissing: true }, (openErr) => {
      if (openErr) return reject(openErr);
      db.put(HEALTHY_KEY, VALUE, (e1) => {
        if (e1) return reject(e1);
        db.put(CORRUPT_KEY, VALUE, (e2) => {
          if (e2) return reject(e2);
          db.close((e3) => (e3 ? reject(e3) : resolve()));
        });
      });
    });
  });
}

describe("LevelPersist corrupt-key removal (LAZ-788)", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = mkdtempSync(path.join(tmpdir(), "lp788-"));
  });

  afterEach(() => {
    DuckDBSingleton.getInstance().close();
    try {
      rmSync(dbPath, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  });

  async function openPersist(): Promise<LevelPersist> {
    const singleton = DuckDBSingleton.getInstance();
    await singleton.initialize(EXT_DIR);
    const alias = singleton.nextAlias();
    const conn = await singleton.attachDatabase(dbPath, alias);
    return new LevelPersist(conn, alias);
  }

  const fileEntries = (kvs: Array<{ key: string[]; value: string }>) =>
    kvs.filter((kv) => kv.key.length === 5 && kv.key[2] === "files");

  it("extension binary is present", () => {
    expect(existsSync(path.join(EXT_DIR, "v1.5.1", PLATFORM, "level_pivot.duckdb_extension"))).toBe(
      true,
    );
  });

  it("reads an invalid-UTF-8 key lossily, so it no longer matches the bytes on disk", async () => {
    await injectRawKeys(dbPath);
    const persist = await openPersist();

    const files = fileEntries(await persist.getAllKVs());
    expect(files.map((kv) => kv.key[3])).toContain(HEALTHY_ID);

    const corrupt = files.find((kv) => kv.key[3] !== HEALTHY_ID);
    expect(corrupt, "corrupt download entry should be visible").toBeDefined();

    const readBackKey = corrupt!.key.join("###");
    // Lossy: the string we read back, re-encoded to UTF-8, is NOT the on-disk bytes.
    expect(Buffer.from(readBackKey, "utf-8").equals(CORRUPT_KEY)).toBe(false);
    // The invalid bytes came back as replacement characters.
    expect(corrupt!.key[3]).toContain("�");
  });

  it("does NOT remove the corrupt key via key-based removeItem (repro)", async () => {
    await injectRawKeys(dbPath);
    const persist = await openPersist();

    const corrupt = fileEntries(await persist.getAllKVs()).find((kv) => kv.key[3] !== HEALTHY_ID);
    expect(corrupt).toBeDefined();

    // Vortex's repair path: read the key back, then removeItem(it).
    await persist.removeItem(corrupt!.key);

    const afterFiles = fileEntries(await persist.getAllKVs());
    // BUG: the corrupt row survives — its stored bytes don't match the re-encoded key.
    expect(afterFiles.some((kv) => kv.key[3] !== HEALTHY_ID)).toBe(true);
    // Control: a healthy key IS removable via the same path.
    await persist.removeItem([...FILES_PREFIX.split("###").filter(Boolean), HEALTHY_ID, "size"]);
    expect(fileEntries(await persist.getAllKVs()).some((kv) => kv.key[3] === HEALTHY_ID)).toBe(
      false,
    );
  });

  // The raw key-based delete inherently cannot remove this key (its bytes don't
  // round-trip). The fix does not change removeItem — it heals at a clean prefix
  // in the main process before hydration; see healInvalidKeys.test.integration.ts.
});
