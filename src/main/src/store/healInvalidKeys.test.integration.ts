/**
 * Tests `healInvalidKeys` (LAZ-788) against the real level_pivot extension over
 * a real LevelDB store, with corrupt keys injected at the byte level via
 * `leveldown`.
 *
 * The hive-safety case is critical: a heal must never be able to wipe a whole
 * hive, which would destroy the user's modding environment.
 *
 * Requires the extension binary: `pnpm --filter @vortex/main run
 * download-duckdb-extensions`.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import DuckDBSingleton from "./DuckDBSingleton";
import { healInvalidKeys } from "./healInvalidKeys";
import LevelPersist from "./LevelPersist";

const require = createRequire(import.meta.url);
const leveldown = require("leveldown") as (dbPath: string) => LevelDown;

interface LevelDown {
  open(opts: { createIfMissing: boolean }, cb: (err?: Error) => void): void;
  put(key: Buffer, value: Buffer, cb: (err?: Error) => void): void;
  close(cb: (err?: Error) => void): void;
}

const EXT_DIR = path.resolve(import.meta.dirname, "../../build/duckdb-extensions");
const BAD = Buffer.from([0xff, 0xff, 0xff, 0xff]); // never valid UTF-8 -> U+FFFD on read
const CTRL = Buffer.from([0x01, 0x02]); // C0 control chars, also "clobbered"
const val = (s: string) => Buffer.from(s);

/** Inject raw key/value byte pairs directly into the LevelDB store. */
function inject(dbPath: string, pairs: Array<[Buffer, Buffer]>): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = leveldown(dbPath);
    db.open({ createIfMissing: true }, (openErr) => {
      if (openErr) return reject(openErr);
      const step = (i: number): void => {
        if (i >= pairs.length) return db.close((e) => (e ? reject(e) : resolve()));
        const [k, v] = pairs[i]!;
        db.put(k, v, (e) => (e ? reject(e) : step(i + 1)));
      };
      step(0);
    });
  });
}

describe("healInvalidKeys (LAZ-788 fix)", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = mkdtempSync(path.join(tmpdir(), "heal788-"));
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

  const joined = (persist: LevelPersist) =>
    persist.getAllKeys().then((keys) => keys.map((k) => k.join("###")));
  const anyClobbered = (persist: LevelPersist) =>
    persist.getAllKeys().then((keys) => keys.some((k) => k.some((seg) => seg.includes("�"))));

  it("removes a deep clobbered key; preserves valid siblings and other hives", async () => {
    await inject(dbPath, [
      [Buffer.from("persistent###downloads###files###Y-To2XJTA###size"), val("112105")],
      [
        Buffer.concat([
          Buffer.from("persistent###downloads###files###Y-T"),
          BAD,
          Buffer.from("TA###size"),
        ]),
        val("112105"),
      ],
      [Buffer.from("settings###window###width"), val("800")],
    ]);
    const persist = await open();

    const res = await healInvalidKeys(persist);

    expect(res.removed).toBe(1);
    expect(res.rewritten).toBe(1); // the healthy sibling
    expect(res.prefixes).toEqual(["persistent.downloads.files"]);
    expect(await anyClobbered(persist)).toBe(false);

    const keys = await joined(persist);
    expect(keys).toContain("persistent###downloads###files###Y-To2XJTA###size"); // healthy kept
    expect(keys).toContain("settings###window###width"); // other hive untouched
  });

  it("also detects control-char clobbering (not just U+FFFD)", async () => {
    await inject(dbPath, [
      [Buffer.from("persistent###mods###skyrimse###goodmod###installationPath"), val('"goodmod"')],
      [
        Buffer.concat([
          Buffer.from("persistent###mods###skyrimse###bad"),
          CTRL,
          Buffer.from("mod###installationPath"),
        ]),
        val('"x"'),
      ],
    ]);
    const persist = await open();

    const res = await healInvalidKeys(persist);

    expect(res.removed).toBe(1);
    expect(res.prefixes).toEqual(["persistent.mods.skyrimse"]);
    const keys = await joined(persist);
    expect(keys).toContain("persistent###mods###skyrimse###goodmod###installationPath");
  });

  // A heal must never be able to wipe an entire hive.
  it("NEVER deletes a whole hive when corruption is at hive-child depth", async () => {
    // A key clobbered at index 1 -> the only clean prefix is ["persistent"],
    // i.e. the whole hive. Alongside it, a realistic modding environment.
    await inject(dbPath, [
      [Buffer.from("persistent###mods###skyrimse###modA###installationPath"), val('"modA"')],
      [Buffer.from("persistent###mods###skyrimse###modB###installationPath"), val('"modB"')],
      [Buffer.from("persistent###downloads###files###dl1###size"), val("42")],
      [Buffer.from("persistent###profiles###p1###gameId"), val('"skyrimse"')],
      // clobbered SECOND segment -> clean prefix would be the whole `persistent` hive
      [Buffer.concat([Buffer.from("persistent###"), BAD, Buffer.from("###orphan")]), val("x")],
      [Buffer.from("settings###window###width"), val("800")],
    ]);
    const persist = await open();

    const before = await joined(persist);
    const res = await healInvalidKeys(persist);

    // Refused, not healed.
    expect(res.removed).toBe(0);
    expect(res.rewritten).toBe(0);
    expect(res.prefixes).toEqual([]);
    expect(res.skipped.length).toBe(1);

    // The entire hive — and every other key — is exactly as it was. Nothing wiped.
    const after = await joined(persist);
    expect(new Set(after)).toEqual(new Set(before));
    expect(after).toContain("persistent###mods###skyrimse###modA###installationPath");
    expect(after).toContain("persistent###mods###skyrimse###modB###installationPath");
    expect(after).toContain("persistent###profiles###p1###gameId");
    expect(after).toContain("settings###window###width");
  });

  it("is a no-op and idempotent when there is no corruption", async () => {
    await inject(dbPath, [
      [Buffer.from("persistent###downloads###files###dl1###size"), val("1")],
      [Buffer.from("settings###window###width"), val("800")],
    ]);
    const persist = await open();

    const res1 = await healInvalidKeys(persist);
    expect(res1.removed).toBe(0);
    expect(res1.rewritten).toBe(0);

    const res2 = await healInvalidKeys(persist);
    expect(res2).toEqual(res1);
    expect((await joined(persist)).sort()).toEqual(
      ["persistent###downloads###files###dl1###size", "settings###window###width"].sort(),
    );
  });
});
