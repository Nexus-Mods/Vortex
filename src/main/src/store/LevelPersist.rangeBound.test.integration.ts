/**
 * Tests `LevelPersist.getAllKVs(prefix)` against the real level_pivot extension
 * over a real LevelDB store.
 *
 * The prefix read bounds the range with a literal `zzzzzzzzzzz` sentinel, so it
 * only covers children that sort below it. Hydration reconstructs objects from
 * this read (mainPersistence.getPersistedValue), which makes anything above the
 * sentinel invisible to the app while still present on disk.
 *
 * Requires the extension binary: `pnpm --filter @vortex/main run
 * download-duckdb-extensions`.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import DuckDBSingleton from "./DuckDBSingleton";
import LevelPersist from "./LevelPersist";

const EXT_DIR = path.resolve(import.meta.dirname, "../../build/duckdb-extensions");
const PREFIX = "persistent###mods###skyrimse";

describe("LevelPersist.getAllKVs prefix range", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = mkdtempSync(path.join(tmpdir(), "rangebound-"));
  });

  afterEach(() => {
    DuckDBSingleton.getInstance().close();
    try {
      rmSync(dbPath, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  });

  async function open(): Promise<LevelPersist> {
    const s = DuckDBSingleton.getInstance();
    await s.initialize(EXT_DIR);
    const alias = s.nextAlias();
    const conn = await s.attachDatabase(dbPath, alias);
    return new LevelPersist(conn, alias);
  }

  const childrenOf = async (persist: LevelPersist) =>
    (await persist.getAllKVs(PREFIX)).map(({ key }) => key[3]);

  it("returns a mod whose id is plain ascii", async () => {
    const persist = await open();
    await persist.setItem([...PREFIX.split("###"), "SkyUI-12604-5-2SE", "id"], '"SkyUI"');

    expect(await childrenOf(persist)).toContain("SkyUI-12604-5-2SE");
  });

  it("returns a mod whose id starts with a non-ascii character", async () => {
    const persist = await open();
    await persist.setItem([...PREFIX.split("###"), "Ätherische Rüstung-123", "id"], '"Aether"');

    expect(await childrenOf(persist)).toContain("Ätherische Rüstung-123");
  });

  it("returns a non-ascii mod when reading a whole hive", async () => {
    // the hive read is what hydration performs: SubPersistor passes the hive as
    // the prefix, so the mod name sits several segments deeper in the key.
    const persist = await open();
    await persist.setItem([...PREFIX.split("###"), "Ätherische Rüstung-123", "id"], '"Aether"');

    const keys = (await persist.getAllKVs("persistent")).map(({ key }) => key.join("###"));
    expect(keys).toContain(`${PREFIX}###Ätherische Rüstung-123###id`);
  });

  it("returns every mod regardless of where its id sorts", async () => {
    const persist = await open();
    const ids = [
      "SkyUI-12604-5-2SE", // ascii
      "Ätherische Rüstung-123", // U+00C4 -> 0xC3 in utf-8, above 'z'
      "日本語 Voice Pack-9", // CJK, above 'z'
      "~tilde prefixed-1", // 0x7E, above 'z'
      "zzzzzzzzzzzz-last-1", // a long run of 'z'
    ];
    for (const id of ids) {
      await persist.setItem([...PREFIX.split("###"), id, "id"], `"${id}"`);
    }

    const seen = await childrenOf(persist);
    expect([...seen].sort()).toEqual([...ids].sort());
  });
});
