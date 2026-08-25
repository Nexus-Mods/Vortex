/**
 * Structural validation of a leveldb store's level index, read straight from
 * the MANIFEST before the store is attached (which is also the only moment the
 * file is readable on windows - leveldb holds it locked while open).
 *
 * The invariant: every level above 0 holds sorted, disjoint, non-inverted key
 * ranges. Reads resolve through that index - a point get or range seek
 * binary-searches the level and reads the single file whose range covers the
 * key - so where it is broken, live keys become invisible to seeks while a
 * full scan still returns them. Hydration then reads a subtree as absent and
 * the app persists that absence as deletions.
 *
 * Record checksums are deliberately not verified: leveldb itself guards those,
 * and this validator cares about structure only.
 */
import * as fs from "fs";
import * as path from "path";

const BLOCK_SIZE = 32768;
const HEADER_SIZE = 7;

// log record types
const FULL = 1;
const FIRST = 2;
const MIDDLE = 3;
const LAST = 4;

// VersionEdit tags
const TAG_COMPARATOR = 1;
const TAG_LOG_NUMBER = 2;
const TAG_NEXT_FILE = 3;
const TAG_LAST_SEQUENCE = 4;
const TAG_COMPACT_POINTER = 5;
const TAG_DELETED_FILE = 6;
const TAG_NEW_FILE = 7;
const TAG_PREV_LOG_NUMBER = 9;

const BYTEWISE_COMPARATOR = "leveldb.BytewiseComparator";

export interface ILayoutReport {
  ok: boolean;
  // level number -> file count at that level
  levels: Record<number, number>;
  problems: string[];
  skipped?: "no-manifest" | "unknown-comparator" | "parse-error";
}

interface IManifestFile {
  level: number;
  num: number;
  smallest: Buffer;
  largest: Buffer;
}

/** reassemble the manifest's log records (FULL, or FIRST/MIDDLE/LAST spans) */
function readRecords(buf: Buffer): Buffer[] {
  const records: Buffer[] = [];
  let pos = 0;
  let pending: Buffer[] | undefined;
  while (pos + HEADER_SIZE <= buf.length) {
    const offsetInBlock = pos % BLOCK_SIZE;
    if (BLOCK_SIZE - offsetInBlock < HEADER_SIZE) {
      pos += BLOCK_SIZE - offsetInBlock;
      continue;
    }
    const length = buf.readUInt16LE(pos + 4);
    const type = buf[pos + 6];
    if (type === 0 && length === 0) {
      // zero-padded block tail
      pos += BLOCK_SIZE - offsetInBlock;
      continue;
    }
    const payload = buf.subarray(pos + HEADER_SIZE, pos + HEADER_SIZE + length);
    pos += HEADER_SIZE + length;
    if (type === FULL) {
      records.push(payload);
    } else if (type === FIRST) {
      pending = [payload];
    } else if (type === MIDDLE && pending !== undefined) {
      pending.push(payload);
    } else if (type === LAST && pending !== undefined) {
      pending.push(payload);
      records.push(Buffer.concat(pending));
      pending = undefined;
    }
  }
  return records;
}

class EditReader {
  private mBuf: Buffer;
  private mPos = 0;

  constructor(buf: Buffer) {
    this.mBuf = buf;
  }

  public eof(): boolean {
    return this.mPos >= this.mBuf.length;
  }

  public varint(): number {
    let result = 0;
    let shift = 0;
    for (;;) {
      const byte = this.mBuf[this.mPos] ?? 0;
      this.mPos += 1;
      result += (byte & 0x7f) * 2 ** shift;
      if ((byte & 0x80) === 0) {
        return result;
      }
      shift += 7;
    }
  }

  public slice(): Buffer {
    const length = this.varint();
    const out = this.mBuf.subarray(this.mPos, this.mPos + length);
    this.mPos += length;
    return out;
  }
}

/** internal keys carry an 8-byte sequence/type trailer after the user key */
function userKey(internalKey: Buffer): Buffer {
  return internalKey.subarray(0, Math.max(0, internalKey.length - 8));
}

function parseManifest(manifestPath: string): { comparator?: string; files: IManifestFile[] } {
  // file id -> file, so delete edits can drop entries added by earlier edits
  const files: Record<string, IManifestFile> = {};
  let comparator: string | undefined;
  for (const record of readRecords(fs.readFileSync(manifestPath))) {
    const reader = new EditReader(record);
    while (!reader.eof()) {
      const tag = reader.varint();
      if (tag === TAG_COMPARATOR) {
        comparator = reader.slice().toString();
      } else if (
        tag === TAG_LOG_NUMBER ||
        tag === TAG_NEXT_FILE ||
        tag === TAG_LAST_SEQUENCE ||
        tag === TAG_PREV_LOG_NUMBER
      ) {
        reader.varint();
      } else if (tag === TAG_COMPACT_POINTER) {
        reader.varint();
        reader.slice();
      } else if (tag === TAG_DELETED_FILE) {
        const level = reader.varint();
        const num = reader.varint();
        delete files[`${level}:${num}`];
      } else if (tag === TAG_NEW_FILE) {
        const level = reader.varint();
        const num = reader.varint();
        reader.varint(); // file size
        const smallest = reader.slice();
        const largest = reader.slice();
        files[`${level}:${num}`] = { level, num, smallest, largest };
      } else {
        // unknown tag: length is unknowable, the rest of this record can't be
        // decoded safely
        break;
      }
    }
  }
  return { comparator, files: Object.values(files) };
}

export function validateLevelLayout(dbDir: string): ILayoutReport {
  let manifestPath: string;
  try {
    const current = fs.readFileSync(path.join(dbDir, "CURRENT"), "utf8").trim();
    manifestPath = path.join(dbDir, current);
    fs.statSync(manifestPath);
  } catch {
    return { ok: true, levels: {}, problems: [], skipped: "no-manifest" };
  }

  let comparator: string | undefined;
  let files: IManifestFile[];
  try {
    ({ comparator, files } = parseManifest(manifestPath));
  } catch {
    // an unreadable manifest is leveldb's problem to report, not ours to guess at
    return { ok: true, levels: {}, problems: [], skipped: "parse-error" };
  }

  if (comparator !== undefined && comparator !== BYTEWISE_COMPARATOR) {
    // byte order is not the sort order under a custom comparator, so any
    // verdict this validator reached would be meaningless
    return { ok: true, levels: {}, problems: [], skipped: "unknown-comparator" };
  }

  // level number -> files at that level
  const byLevel: Record<number, IManifestFile[]> = {};
  for (const file of files) {
    (byLevel[file.level] ??= []).push(file);
  }

  const problems: string[] = [];
  const levels: Record<number, number> = {};
  for (const [levelStr, list] of Object.entries(byLevel)) {
    const level = Number(levelStr);
    levels[level] = list.length;
    list.sort((lhs, rhs) => Buffer.compare(userKey(lhs.smallest), userKey(rhs.smallest)));
    for (const file of list) {
      if (Buffer.compare(userKey(file.smallest), userKey(file.largest)) > 0) {
        problems.push(`INVERTED L${level} #${file.num}`);
      }
    }
    if (level === 0) {
      // level-0 files come straight from memtable flushes and may overlap
      continue;
    }
    for (let i = 1; i < list.length; i += 1) {
      const previous = list[i - 1];
      const current = list[i];
      if (previous === undefined || current === undefined) {
        continue;
      }
      if (Buffer.compare(userKey(previous.largest), userKey(current.smallest)) >= 0) {
        problems.push(`OVERLAP L${level} #${previous.num}..#${current.num}`);
      }
    }
  }

  return { ok: problems.length === 0, levels, problems };
}
