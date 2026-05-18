/**
 * Creates synthetic BA2 test archives with known content.
 * These are valid BA2 v1 files that can be parsed by our TypeScript implementation.
 *
 * Run: npx tsx extensions/gamebryo-ba2-support/scripts/create-test-archives.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { deflateSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "test-data");
mkdirSync(OUT_DIR, { recursive: true });

// --- Helpers ---

function writeUint32LE(buf: Buffer, offset: number, val: number) {
  buf.writeUInt32LE(val, offset);
}

function writeUint64LE(buf: Buffer, offset: number, val: number) {
  buf.writeUInt32LE(val & 0xffffffff, offset);
  buf.writeUInt32LE(Math.floor(val / 0x100000000), offset + 4);
}

function writeString(buf: Buffer, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    buf[offset + i] = str.charCodeAt(i);
  }
}

// --- Create GNRL archive ---

interface FileEntry {
  name: string;
  content: Buffer;
  compressed: Buffer;
  useCompression: boolean;
}

function createGnrlArchive(): { buf: Buffer; files: string[] } {
  const files = [
    { name: "meshes\\weapon\\gun.nif", content: Buffer.from("fake nif data for gun model") },
    { name: "scripts\\myscript.pex", content: Buffer.from("fake compiled papyrus script") },
    { name: "materials\\test.bgsm", content: Buffer.from("fake material data") },
  ];

  const entries: FileEntry[] = files.map((f) => {
    const compressed = deflateSync(f.content);
    return {
      name: f.name,
      content: f.content,
      compressed,
      useCompression: compressed.length < f.content.length,
    };
  });

  const HEADER_SIZE = 24;
  const ENTRY_SIZE = 36;
  const entriesStart = HEADER_SIZE;
  const entriesEnd = entriesStart + entries.length * ENTRY_SIZE;

  let dataOffset = entriesEnd;
  const entryOffsets: number[] = [];
  for (const entry of entries) {
    entryOffsets.push(dataOffset);
    dataOffset += entry.useCompression ? entry.compressed.length : entry.content.length;
  }

  const nameTableOffset = dataOffset;

  const nameParts: Buffer[] = [];
  for (const entry of entries) {
    const nameBuf = Buffer.alloc(2 + entry.name.length);
    nameBuf.writeUInt16LE(entry.name.length, 0);
    nameBuf.write(entry.name, 2, "ascii");
    nameParts.push(nameBuf);
  }
  const nameTable = Buffer.concat(nameParts);

  const totalSize = nameTableOffset + nameTable.length;
  const buf = Buffer.alloc(totalSize);

  writeString(buf, 0x00, "BTDX");
  writeUint32LE(buf, 0x04, 1);
  writeString(buf, 0x08, "GNRL");
  writeUint32LE(buf, 0x0c, entries.length);
  writeUint64LE(buf, 0x10, nameTableOffset);

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const off = entriesStart + i * ENTRY_SIZE;
    writeUint32LE(buf, off + 0x00, 0x12345678);
    const ext = e.name.split(".").pop() || "";
    writeString(buf, off + 0x04, ext.slice(0, 4).padEnd(4, "\0"));
    writeUint32LE(buf, off + 0x08, 0xaabbccdd);
    writeUint32LE(buf, off + 0x0c, 0x00100100);
    writeUint64LE(buf, off + 0x10, entryOffsets[i]);
    writeUint32LE(buf, off + 0x18, e.useCompression ? e.compressed.length : 0);
    writeUint32LE(buf, off + 0x1c, e.content.length);
    writeUint32LE(buf, off + 0x20, 0xbaadf00d);
  }

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const data = e.useCompression ? e.compressed : e.content;
    data.copy(buf, entryOffsets[i]);
  }

  nameTable.copy(buf, nameTableOffset);
  return { buf, files: entries.map((e) => e.name) };
}

// --- Create DX10 archive ---

interface TextureDef {
  name: string;
  width: number;
  height: number;
  numMips: number;
  dxgiFormat: number;
  chunks: Buffer[];
}

interface CompressedChunk {
  original: Buffer;
  compressed: Buffer;
  useCompression: boolean;
  offset: number;
}

function createDx10Archive(): { buf: Buffer; files: string[] } {
  const textures: TextureDef[] = [
    {
      name: "textures\\weapons\\gun_d.dds",
      width: 256,
      height: 256,
      numMips: 9,
      dxgiFormat: 71,
      chunks: [
        Buffer.from("fake mip0 texture data chunk that is reasonably long for compression"),
        Buffer.from("fake mip1 data"),
      ],
    },
    {
      name: "textures\\weapons\\gun_n.dds",
      width: 128,
      height: 128,
      numMips: 8,
      dxgiFormat: 77,
      chunks: [Buffer.from("fake normal map chunk data for testing the dx10 parser")],
    },
  ];

  const HEADER_SIZE = 24;

  let entriesSize = 0;
  for (const tex of textures) {
    entriesSize += 24 + tex.chunks.length * 24;
  }

  const entriesStart = HEADER_SIZE;
  const entriesEnd = entriesStart + entriesSize;

  let dataOffset = entriesEnd;
  const texEntries = textures.map((tex) => {
    const compressedChunks: CompressedChunk[] = tex.chunks.map((chunk) => {
      const compressed = deflateSync(chunk);
      const offset = dataOffset;
      const useCompression = compressed.length < chunk.length;
      dataOffset += useCompression ? compressed.length : chunk.length;
      return { original: chunk, compressed, useCompression, offset };
    });
    return { ...tex, compressedChunks };
  });

  const nameTableOffset = dataOffset;

  const nameParts: Buffer[] = [];
  for (const tex of texEntries) {
    const nameBuf = Buffer.alloc(2 + tex.name.length);
    nameBuf.writeUInt16LE(tex.name.length, 0);
    nameBuf.write(tex.name, 2, "ascii");
    nameParts.push(nameBuf);
  }
  const nameTable = Buffer.concat(nameParts);

  const totalSize = nameTableOffset + nameTable.length;
  const buf = Buffer.alloc(totalSize);

  writeString(buf, 0x00, "BTDX");
  writeUint32LE(buf, 0x04, 1);
  writeString(buf, 0x08, "DX10");
  writeUint32LE(buf, 0x0c, texEntries.length);
  writeUint64LE(buf, 0x10, nameTableOffset);

  let entryOffset = entriesStart;
  for (const tex of texEntries) {
    writeUint32LE(buf, entryOffset + 0x00, 0x12345678);
    writeString(buf, entryOffset + 0x04, "dds\0");
    writeUint32LE(buf, entryOffset + 0x08, 0xaabbccdd);
    buf[entryOffset + 0x0c] = 0;
    buf[entryOffset + 0x0d] = tex.compressedChunks.length;
    buf.writeUInt16LE(24, entryOffset + 0x0e);
    buf.writeUInt16LE(tex.height, entryOffset + 0x10);
    buf.writeUInt16LE(tex.width, entryOffset + 0x12);
    buf[entryOffset + 0x14] = tex.numMips;
    buf[entryOffset + 0x15] = tex.dxgiFormat;
    buf.writeUInt16LE(0x0800, entryOffset + 0x16);
    entryOffset += 24;

    let mipCounter = 0;
    for (const chunk of tex.compressedChunks) {
      writeUint64LE(buf, entryOffset + 0x00, chunk.offset);
      writeUint32LE(buf, entryOffset + 0x08, chunk.useCompression ? chunk.compressed.length : 0);
      writeUint32LE(buf, entryOffset + 0x0c, chunk.original.length);
      buf.writeUInt16LE(mipCounter, entryOffset + 0x10);
      buf.writeUInt16LE(mipCounter, entryOffset + 0x12);
      writeUint32LE(buf, entryOffset + 0x14, 0xbaadf00d);
      entryOffset += 24;
      mipCounter++;
    }
  }

  for (const tex of texEntries) {
    for (const chunk of tex.compressedChunks) {
      const data = chunk.useCompression ? chunk.compressed : chunk.original;
      data.copy(buf, chunk.offset);
    }
  }

  nameTable.copy(buf, nameTableOffset);
  return { buf, files: texEntries.map((t) => t.name) };
}

// --- Create stripped versions (header + entries + name table, no file data) ---

function stripArchive(fullBuf: Buffer): Buffer {
  const fileCount = fullBuf.readUInt32LE(0x0c);
  const nameTableOffset = Number(fullBuf.readBigUInt64LE(0x10));
  const type = fullBuf.toString("ascii", 0x08, 0x0c);

  let entriesEnd: number;
  if (type === "GNRL") {
    entriesEnd = 24 + fileCount * 36;
  } else {
    let off = 24;
    for (let i = 0; i < fileCount; i++) {
      const numChunks = fullBuf[off + 0x0d];
      off += 24 + numChunks * 24;
    }
    entriesEnd = off;
  }

  const headerAndEntries = Buffer.from(fullBuf.subarray(0, entriesEnd));
  const nameTable = Buffer.from(fullBuf.subarray(nameTableOffset));

  const newNameTableOffset = entriesEnd;
  const stripped = Buffer.concat([headerAndEntries, nameTable]);
  stripped.writeBigUInt64LE(BigInt(newNameTableOffset), 0x10);

  return stripped;
}

// --- Main ---

const gnrl = createGnrlArchive();
const dx10 = createDx10Archive();

writeFileSync(join(OUT_DIR, "test-gnrl-full.ba2"), gnrl.buf);
writeFileSync(join(OUT_DIR, "test-dx10-full.ba2"), dx10.buf);

writeFileSync(join(OUT_DIR, "test-gnrl.ba2"), stripArchive(gnrl.buf));
writeFileSync(join(OUT_DIR, "test-dx10.ba2"), stripArchive(dx10.buf));

const verification = {
  gnrl: {
    type: "general",
    version: 1,
    fileCount: gnrl.files.length,
    fileList: gnrl.files,
  },
  dx10: {
    type: "dx10",
    version: 1,
    fileCount: dx10.files.length,
    fileList: dx10.files,
  },
};
writeFileSync(join(OUT_DIR, "expected.json"), JSON.stringify(verification, null, 2) + "\n");

console.log("Created test archives:");
console.log("  test-gnrl-full.ba2:", gnrl.buf.length, "bytes");
console.log("  test-dx10-full.ba2:", dx10.buf.length, "bytes");
console.log("  test-gnrl.ba2:", stripArchive(gnrl.buf).length, "bytes (stripped)");
console.log("  test-dx10.ba2:", stripArchive(dx10.buf).length, "bytes (stripped)");
console.log("  expected.json");
console.log("\nGNRL files:", gnrl.files);
console.log("DX10 files:", dx10.files);
