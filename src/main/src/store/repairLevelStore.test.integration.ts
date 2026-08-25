/**
 * Tests `repairLevelStore` against the real level_pivot extension: the full
 * contents of a store are read by scan, rewritten into a fresh store, and the
 * original preserved next to it. Runs on a healthy store - the repair path
 * itself must not depend on the corruption being present.
 *
 * Requires the extension binary: `pnpm --filter @vortex/main run
 * download-duckdb-extensions`.
 */
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import DuckDBSingleton from "./DuckDBSingleton";
import { validateLevelLayout } from "./levelLayout";
import LevelPersist from "./LevelPersist";
import { repairLevelStore } from "./repairLevelStore";

const EXT_DIR = path.resolve(import.meta.dirname, "../../build/duckdb-extensions");

describe("repairLevelStore", () => {
  let baseDir: string;
  let dbPath: string;

  beforeEach(() => {
    baseDir = mkdtempSync(path.join(tmpdir(), "repair-"));
    dbPath = path.join(baseDir, "state.v2");
  });

  afterEach(() => {
    DuckDBSingleton.getInstance().close();
    try {
      rmSync(baseDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  });

  async function open(): Promise<LevelPersist> {
    const singleton = DuckDBSingleton.getInstance();
    await singleton.initialize(EXT_DIR);
    const alias = singleton.nextAlias();
    const connection = await singleton.attachDatabase(dbPath, alias);
    return new LevelPersist(connection, alias);
  }

  function detachAll(): void {
    // repair needs the store unlocked; tests attach through the singleton
    DuckDBSingleton.getInstance().close();
  }

  it("rewrites every row into a store with a valid layout", async () => {
    const persist = await open();
    const rows: Array<[string[], string]> = [
      [["persistent", "mods", "skyrimse", "SkyUI-12604", "id"], '"SkyUI"'],
      [["persistent", "mods", "skyrimse", "SkyUI-12604", "state"], '"installed"'],
      [["persistent", "mods", "Ätherische Welt", "Mod-1", "id"], '"aether"'],
      [["persistent", "mods", "日本語ゲーム", "Mod-2", "id"], '"jp"'],
      [["persistent", "downloads", "files", "dl1", "size"], "42"],
      [["settings", "window", "width"], "800"],
    ];
    for (const [key, value] of rows) {
      await persist.setItem(key, value);
    }
    detachAll();

    const result = await repairLevelStore(dbPath, EXT_DIR);
    expect(result.repaired).toBe(true);
    expect(result.rows).toBe(rows.length);

    // the repair must not consume alias draws: the query system's SQL
    // references the catalog "db" literally, so the store's next real attach
    // has to still receive it
    expect(DuckDBSingleton.getInstance().nextAlias()).toBe("db");

    // the repaired store holds exactly the same data
    const reopened = await open();
    const kvs = await reopened.getAllKVs();
    const byKey = new Map(kvs.map(({ key, value }) => [key.join("###"), value]));
    expect(byKey.size).toBe(rows.length);
    for (const [key, value] of rows) {
      expect(byKey.get(key.join("###"))).toBe(value);
    }
    detachAll();

    // its layout validates, and the original survives as evidence
    expect(validateLevelLayout(dbPath).ok).toBe(true);
    const preserved = readdirSync(baseDir).filter((name) => name.startsWith("state.v2.corrupt-"));
    expect(preserved).toHaveLength(1);
  });

  it("leaves the original in place when the store cannot be read", async () => {
    // no store exists at all - repair must not fabricate one
    const result = await repairLevelStore(dbPath, EXT_DIR);
    expect(result.repaired).toBe(false);
    expect(existsSync(dbPath)).toBe(false);
  });
});
