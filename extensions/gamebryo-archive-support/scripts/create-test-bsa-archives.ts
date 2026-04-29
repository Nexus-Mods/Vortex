/**
 * Creates synthetic BSA test archives with known content for all three versions.
 * These are valid BSA files that can be parsed and extracted by our TypeScript
 * implementation, containing only fake data (no copyrighted content).
 *
 * Run: npx tsx extensions/gamebryo-archive-support/scripts/create-test-bsa-archives.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { deflateSync } from "zlib";

import * as lz4js from "lz4js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "test-data");
mkdirSync(OUT_DIR, { recursive: true });

// --- BSA Hash (duplicated from bsa.ts to keep script self-contained) ---

function genHashInt(data: Uint8Array, start: number, end: number): number {
  let hash = 0;
  for (let i = start; i < end; i++) {
    hash = Math.imul(hash, 0x1003f) + data[i];
    hash = hash >>> 0;
  }
  return hash;
}

function calculateBSAHash(fileName: string): bigint {
  let lower = "";
  for (let i = 0; i < fileName.length; i++) {
    let ch = fileName.charCodeAt(i);
    if (ch >= 0x41 && ch <= 0x5a) ch += 0x20;
    if (ch === 0x2f) ch = 0x5c;
    lower += String.fromCharCode(ch);
  }

  const bytes = new Uint8Array(lower.length);
  for (let i = 0; i < lower.length; i++) {
    bytes[i] = lower.charCodeAt(i);
  }

  const dotIdx = lower.lastIndexOf(".");
  const extStart = dotIdx >= 0 ? dotIdx : lower.length;
  const stemLen = extStart;
  const ext = lower.substring(extStart);

  let hash1 = 0;
  if (stemLen > 0) {
    hash1 =
      bytes[stemLen - 1] |
      ((stemLen > 2 ? bytes[stemLen - 2] : 0) << 8) |
      (stemLen << 16) |
      (bytes[0] << 24);
    hash1 = hash1 >>> 0;
  }

  if (ext.length > 0) {
    const extBody = ext.substring(1);
    if (extBody === "kf") hash1 |= 0x80;
    else if (extBody === "nif") hash1 |= 0x8000;
    else if (extBody === "dds") hash1 |= 0x8080;
    else if (extBody === "wav") hash1 |= 0x80000000;
    hash1 = hash1 >>> 0;

    const h2a = genHashInt(bytes, 1, extStart - 2);
    const h2b = genHashInt(bytes, extStart, bytes.length);
    const hash2 = ((h2a + h2b) & 0xffffffff) >>> 0;

    return (
      (BigInt(hash1 >>> 0) | (BigInt(hash2) << 32n)) & 0xffffffffffffffffn
    );
  }

  return BigInt(hash1 >>> 0);
}

// --- BSA Format Constants ---

const BSA_HEADER_SIZE = 36;
const FLAG_HASDIRNAMES = 0x01;
const FLAG_HASFILENAMES = 0x02;
const FLAG_DEFAULTCOMPRESSED = 0x04;

interface TestFile {
  folder: string;
  name: string;
  content: Buffer;
}

// --- Test data ---

// Use repetitive content so compression actually shrinks it
const TEST_FILES: TestFile[] = [
  {
    folder: "meshes\\weapons",
    name: "sword.nif",
    content: Buffer.from("FAKE_NIF_" + "sword mesh vertex data ".repeat(20)),
  },
  {
    folder: "meshes\\weapons",
    name: "shield.nif",
    content: Buffer.from("FAKE_NIF_" + "shield mesh triangle data ".repeat(15)),
  },
  {
    folder: "textures\\armor",
    name: "iron.dds",
    content: Buffer.from("FAKE_DDS_" + "iron texture pixel data ".repeat(25)),
  },
  {
    folder: "scripts\\quest",
    name: "main.pex",
    content: Buffer.from("FAKE_PEX_compiled papyrus bytecode data"),
  },
];

// --- Archive builder ---

interface FolderGroup {
  path: string;
  files: TestFile[];
}

function groupByFolder(files: TestFile[]): FolderGroup[] {
  const map = new Map<string, TestFile[]>();
  for (const f of files) {
    const key = f.folder.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  return Array.from(map.entries()).map(([, files]) => ({
    path: files[0].folder,
    files,
  }));
}

function buildBSA(
  version: number,
  archiveFlags: number,
  files: TestFile[],
  compressor?: (buf: Buffer) => Buffer,
): Buffer {
  const folders = groupByFolder(files);
  const isSkyrimSE = version === 0x69;
  const isCompressed = (archiveFlags & FLAG_DEFAULTCOMPRESSED) !== 0;
  const folderRecordSize = isSkyrimSE ? 24 : 16;
  const fileRecordSize = 16;

  const folderCount = folders.length;
  const fileCount = files.length;

  let totalFolderNameLength = 0;
  for (const f of folders) {
    totalFolderNameLength += f.path.length;
  }

  let totalFileNameLength = 0;
  for (const f of folders) {
    for (const tf of f.files) {
      totalFileNameLength += tf.name.length + 1;
    }
  }

  // Determine file flags
  let fileFlags = 0;
  for (const tf of files) {
    const ext = tf.name.split(".").pop() || "";
    if (ext === "nif") fileFlags |= 1 << 0;
    else if (ext === "dds") fileFlags |= 1 << 1;
    else if (ext === "xml") fileFlags |= 1 << 2;
    else if (ext === "wav") fileFlags |= 1 << 3;
    else if (ext === "txt") fileFlags |= 1 << 5;
  }

  // Prepare file data (possibly compressed)
  interface PreparedFile {
    onDiskData: Buffer; // what gets written to the data section
    recordSize: number; // size field in the file record
  }

  const preparedFiles: PreparedFile[] = [];
  for (const f of folders) {
    for (const tf of f.files) {
      if (isCompressed && compressor) {
        const compressed = compressor(tf.content);
        // On disk: 4-byte origSize + compressed data
        const onDisk = Buffer.alloc(4 + compressed.length);
        onDisk.writeUInt32LE(tf.content.length, 0);
        compressed.copy(onDisk, 4);
        preparedFiles.push({
          onDiskData: onDisk,
          recordSize: onDisk.length, // total including 4-byte prefix
        });
      } else {
        preparedFiles.push({
          onDiskData: tf.content,
          recordSize: tf.content.length,
        });
      }
    }
  }

  // Layout
  const folderRecordsStart = BSA_HEADER_SIZE;
  const folderDataStart = folderRecordsStart + folderCount * folderRecordSize;

  let folderDataSize = 0;
  for (const f of folders) {
    folderDataSize += 1 + f.path.length + 1; // BString: len + chars + null
    folderDataSize += f.files.length * fileRecordSize;
  }

  const fileNamesStart = folderDataStart + folderDataSize;
  const fileDataStart = fileNamesStart + totalFileNameLength;

  // Compute file data offsets
  const fileDataOffsets: number[] = [];
  let currentOffset = fileDataStart;
  for (const pf of preparedFiles) {
    fileDataOffsets.push(currentOffset);
    currentOffset += pf.onDiskData.length;
  }

  const totalSize = currentOffset;
  const buf = Buffer.alloc(totalSize);

  // Write header
  buf.write("BSA\0", 0, 4, "ascii");
  buf.writeUInt32LE(version, 4);
  buf.writeUInt32LE(0x24, 8);
  buf.writeUInt32LE(archiveFlags, 12);
  buf.writeUInt32LE(folderCount, 16);
  buf.writeUInt32LE(fileCount, 20);
  buf.writeUInt32LE(totalFolderNameLength, 24);
  buf.writeUInt32LE(totalFileNameLength, 28);
  buf.writeUInt32LE(fileFlags, 32);

  // Write folder records
  let folderRecordOff = folderRecordsStart;
  let folderDataOff = folderDataStart;

  for (let fi = 0; fi < folders.length; fi++) {
    const f = folders[fi];
    const folderHash = calculateBSAHash(f.path);

    if (isSkyrimSE) {
      // SSE: hash(8) + count(4) + padding(4) + offset(8) = 24
      buf.writeBigUInt64LE(folderHash, folderRecordOff);
      buf.writeUInt32LE(f.files.length, folderRecordOff + 8);
      buf.writeUInt32LE(0, folderRecordOff + 12); // padding
      buf.writeBigUInt64LE(
        BigInt(folderDataOff + totalFileNameLength),
        folderRecordOff + 16,
      );
    } else {
      buf.writeBigUInt64LE(folderHash, folderRecordOff);
      buf.writeUInt32LE(f.files.length, folderRecordOff + 8);
      buf.writeUInt32LE(
        folderDataOff + totalFileNameLength,
        folderRecordOff + 12,
      );
    }
    folderRecordOff += folderRecordSize;

    // Advance folderDataOff past this folder's data for next iteration
    folderDataOff += 1 + f.path.length + 1 + f.files.length * fileRecordSize;
  }

  // Write folder data (BString names + file records)
  let dataOff = folderDataStart;
  let globalFileIdx = 0;

  for (const f of folders) {
    // BString: length byte (includes null terminator), chars, null
    const nameBytes = f.path.length + 1;
    buf[dataOff] = nameBytes;
    dataOff += 1;
    buf.write(f.path, dataOff, f.path.length, "ascii");
    dataOff += f.path.length;
    buf[dataOff] = 0;
    dataOff += 1;

    // File records
    for (const tf of f.files) {
      const fileHash = calculateBSAHash(tf.name);
      buf.writeBigUInt64LE(fileHash, dataOff);
      buf.writeUInt32LE(preparedFiles[globalFileIdx].recordSize, dataOff + 8);
      buf.writeUInt32LE(fileDataOffsets[globalFileIdx], dataOff + 12);
      dataOff += fileRecordSize;
      globalFileIdx++;
    }
  }

  // Write file names block
  let nameOff = fileNamesStart;
  for (const f of folders) {
    for (const tf of f.files) {
      buf.write(tf.name, nameOff, tf.name.length, "ascii");
      nameOff += tf.name.length;
      buf[nameOff] = 0;
      nameOff += 1;
    }
  }

  // Write file data
  for (let i = 0; i < preparedFiles.length; i++) {
    preparedFiles[i].onDiskData.copy(buf, fileDataOffsets[i]);
  }

  return buf;
}

// --- Create archives ---

const v103 = buildBSA(0x67, FLAG_HASDIRNAMES | FLAG_HASFILENAMES, TEST_FILES);

const v104 = buildBSA(
  0x68,
  FLAG_HASDIRNAMES | FLAG_HASFILENAMES | FLAG_DEFAULTCOMPRESSED,
  TEST_FILES,
  (buf) => deflateSync(buf),
);

const v105 = buildBSA(
  0x69,
  FLAG_HASDIRNAMES | FLAG_HASFILENAMES | FLAG_DEFAULTCOMPRESSED,
  TEST_FILES,
  (buf) => Buffer.from(lz4js.compress(new Uint8Array(buf))),
);

writeFileSync(join(OUT_DIR, "test-v103.bsa"), v103);
writeFileSync(join(OUT_DIR, "test-v104.bsa"), v104);
writeFileSync(join(OUT_DIR, "test-v105.bsa"), v105);

// Write expected content for verification
const expected: Record<string, { version: number; files: Record<string, string> }> = {};
for (const [key, ver] of [
  ["v103", 0x67],
  ["v104", 0x68],
  ["v105", 0x69],
] as const) {
  const files: Record<string, string> = {};
  for (const tf of TEST_FILES) {
    const fullPath = tf.folder + "\\" + tf.name;
    files[fullPath] = tf.content.toString("utf8");
  }
  expected[key] = { version: ver, files };
}

writeFileSync(
  join(OUT_DIR, "expected-bsa.json"),
  JSON.stringify(expected, null, 2) + "\n",
);

console.log("Created BSA test archives:");
console.log(`  test-v103.bsa: ${v103.length} bytes (Oblivion, uncompressed)`);
console.log(`  test-v104.bsa: ${v104.length} bytes (Skyrim LE, zlib compressed)`);
console.log(`  test-v105.bsa: ${v105.length} bytes (Skyrim SE, LZ4 compressed)`);
console.log(`  expected-bsa.json`);
console.log(`\nFiles per archive: ${TEST_FILES.length}`);
