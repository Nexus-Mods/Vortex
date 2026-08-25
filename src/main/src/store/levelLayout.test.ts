/**
 * Tests `validateLevelLayout` against synthesized MANIFESTs. The writer here
 * produces the leveldb log/VersionEdit format with zeroed checksums - the
 * validator reads structure only and does not verify CRCs, so fixtures can
 * state any layout, including the invalid ones a healthy leveldb would never
 * write (which is exactly the state we need to detect).
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { validateLevelLayout } from "./levelLayout";

// --- minimal MANIFEST writer -------------------------------------------------

function varint(n: number): Buffer {
  const out: number[] = [];
  let v = n;
  for (;;) {
    if (v < 0x80) {
      out.push(v);
      return Buffer.from(out);
    }
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
}

function lengthPrefixed(b: Buffer): Buffer {
  return Buffer.concat([varint(b.length), b]);
}

/** internal key: user key + 8-byte sequence/type trailer */
function ikey(user: string): Buffer {
  return Buffer.concat([Buffer.from(user, "utf8"), Buffer.from([1, 1, 0, 0, 0, 0, 0, 0])]);
}

interface IManifestFile {
  level: number;
  num: number;
  smallest: string;
  largest: string;
}

function versionEdit(opts: { comparator?: string; files?: IManifestFile[] }): Buffer {
  const parts: Buffer[] = [];
  if (opts.comparator !== undefined) {
    parts.push(varint(1), lengthPrefixed(Buffer.from(opts.comparator)));
  }
  for (const f of opts.files ?? []) {
    parts.push(
      varint(7), // kNewFile
      varint(f.level),
      varint(f.num),
      varint(1024), // file size, irrelevant to layout
      lengthPrefixed(ikey(f.smallest)),
      lengthPrefixed(ikey(f.largest)),
    );
  }
  return Buffer.concat(parts);
}

/** one FULL log record: crc(ignored) + length + type + payload */
function logRecord(payload: Buffer): Buffer {
  const header = Buffer.alloc(7);
  header.writeUInt16LE(payload.length, 4);
  header[6] = 1; // kFullType
  return Buffer.concat([header, payload]);
}

function writeManifest(dir: string, edits: Buffer[]): void {
  writeFileSync(path.join(dir, "MANIFEST-000001"), Buffer.concat(edits.map(logRecord)));
  writeFileSync(path.join(dir, "CURRENT"), "MANIFEST-000001\n");
}

// --- tests --------------------------------------------------------------------

const BYTEWISE = "leveldb.BytewiseComparator";

describe("validateLevelLayout", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "layout-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("accepts a store with disjoint sorted levels", () => {
    writeManifest(dir, [
      versionEdit({
        comparator: BYTEWISE,
        files: [
          { level: 1, num: 5, smallest: "app###a", largest: "persistent###k" },
          { level: 2, num: 6, smallest: "app###a", largest: "persistent###c" },
          { level: 2, num: 7, smallest: "persistent###d", largest: "settings###z" },
        ],
      }),
    ]);

    const report = validateLevelLayout(dir);
    expect(report.ok).toBe(true);
    expect(report.problems).toEqual([]);
    expect(report.levels).toEqual({ 1: 1, 2: 2 });
  });

  it("flags overlapping ranges within a level above 0", () => {
    writeManifest(dir, [
      versionEdit({
        comparator: BYTEWISE,
        files: [
          { level: 2, num: 6, smallest: "app###a", largest: "persistent###mods###m" },
          { level: 2, num: 7, smallest: "persistent###downloads###d", largest: "settings###z" },
        ],
      }),
    ]);

    const report = validateLevelLayout(dir);
    expect(report.ok).toBe(false);
    expect(report.problems.some((p) => p.startsWith("OVERLAP L2"))).toBe(true);
  });

  it("flags a file whose smallest key exceeds its largest", () => {
    writeManifest(dir, [
      versionEdit({
        comparator: BYTEWISE,
        files: [{ level: 2, num: 9, smallest: "persistent###mods###z", largest: "app###a" }],
      }),
    ]);

    const report = validateLevelLayout(dir);
    expect(report.ok).toBe(false);
    expect(report.problems.some((p) => p.startsWith("INVERTED L2"))).toBe(true);
  });

  it("permits overlap at level 0", () => {
    // level-0 files come straight from memtable flushes and legitimately overlap
    writeManifest(dir, [
      versionEdit({
        comparator: BYTEWISE,
        files: [
          { level: 0, num: 3, smallest: "app###a", largest: "settings###z" },
          { level: 0, num: 4, smallest: "persistent###a", largest: "user###z" },
        ],
      }),
    ]);

    const report = validateLevelLayout(dir);
    expect(report.ok).toBe(true);
  });

  it("honors delete edits when replaying the manifest", () => {
    // second edit removes the overlapping file, so the surviving layout is valid
    writeManifest(dir, [
      versionEdit({
        comparator: BYTEWISE,
        files: [
          { level: 2, num: 6, smallest: "app###a", largest: "persistent###z" },
          { level: 2, num: 7, smallest: "persistent###a", largest: "settings###z" },
        ],
      }),
      Buffer.concat([varint(6), varint(2), varint(7)]), // kDeletedFile level=2 num=7
    ]);

    const report = validateLevelLayout(dir);
    expect(report.ok).toBe(true);
    expect(report.levels).toEqual({ 2: 1 });
  });

  it("skips validation under an unknown comparator", () => {
    // a custom comparator means byte order is not the sort order, so the
    // validator must never report a false positive
    writeManifest(dir, [
      versionEdit({
        comparator: "custom.Comparator",
        files: [
          { level: 2, num: 6, smallest: "b", largest: "z" },
          { level: 2, num: 7, smallest: "a", largest: "c" },
        ],
      }),
    ]);

    const report = validateLevelLayout(dir);
    expect(report.ok).toBe(true);
    expect(report.skipped).toBe("unknown-comparator");
  });

  it("skips a directory that has no manifest", () => {
    const report = validateLevelLayout(dir);
    expect(report.ok).toBe(true);
    expect(report.skipped).toBe("no-manifest");
  });
});
