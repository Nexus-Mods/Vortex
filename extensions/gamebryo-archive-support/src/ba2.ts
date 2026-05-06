import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { inflateSync } from "zlib";

const BA2_MAGIC = "BTDX";
const HEADER_SIZE = 24;
const GNRL_ENTRY_SIZE = 36;

// --- Types ---

interface BA2Header {
  version: number;
  type: "general" | "dx10";
  fileCount: number;
  nameTableOffset: number;
}

interface GnrlFileEntry {
  nameHash: number;
  ext: string;
  dirHash: number;
  flags: number;
  offset: number;
  packedLen: number;
  unpackedLen: number;
}

interface DX10TextureChunk {
  offset: number;
  packedLen: number;
  unpackedLen: number;
  startMip: number;
  endMip: number;
}

interface DX10TextureEntry {
  nameHash: number;
  ext: string;
  dirHash: number;
  numChunks: number;
  chunkHdrLen: number;
  height: number;
  width: number;
  numMips: number;
  dxgiFormat: number;
  chunks: DX10TextureChunk[];
}

// --- DDS header constants ---

const DDS_MAGIC = 0x20534444; // "DDS "
const DDS_HEADER_SIZE = 124;
const DDS_PIXELFORMAT_SIZE = 32;
const DDS_HEADER_FLAGS = 0x00000001 | 0x00000002 | 0x00000004 | 0x00020000; // CAPS|HEIGHT|WIDTH|LINEARSIZE
const DDS_SURFACE_FLAGS = 0x00001000 | 0x00400000 | 0x00000008; // TEXTURE|COMPLEX|MIPMAP
const DDPF_FOURCC = 0x04;
const DDPF_RGB = 0x40;
const DDPF_ALPHA = 0x01;

interface DxgiFormatInfo {
  fourCC?: string;
  bpp: number;
  flags?: number;
  rMask?: number;
  gMask?: number;
  bMask?: number;
  aMask?: number;
}

const DXGI_FORMAT_MAP: Map<number, DxgiFormatInfo> = new Map([
  [70, { fourCC: "DXT1", bpp: 4 }], // BC1_UNORM
  [71, { fourCC: "DXT3", bpp: 8 }], // BC2_UNORM
  [72, { fourCC: "DXT5", bpp: 8 }], // BC3_UNORM
  [77, { fourCC: "ATI2", bpp: 8 }], // BC5_UNORM
  [
    87,
    {
      bpp: 32,
      flags: DDPF_RGB | DDPF_ALPHA,
      rMask: 0x00ff0000,
      gMask: 0x0000ff00,
      bMask: 0x000000ff,
      aMask: 0xff000000,
    },
  ], // B8G8R8A8_UNORM
  [61, { bpp: 8, flags: DDPF_RGB, rMask: 0xff, gMask: 0, bMask: 0, aMask: 0 }], // R8_UNORM
  [98, { fourCC: "DX10", bpp: 8 }], // BC7_UNORM
]);

// --- Public API ---

export class BA2Archive {
  public readonly type: "general" | "dx10";
  public readonly version: number;
  public readonly fileList: string[];

  private filePath: string;
  private header: BA2Header;
  private gnrlEntries?: GnrlFileEntry[];
  private dx10Entries?: DX10TextureEntry[];

  constructor(
    filePath: string,
    header: BA2Header,
    fileList: string[],
    gnrlEntries?: GnrlFileEntry[],
    dx10Entries?: DX10TextureEntry[],
  ) {
    this.filePath = filePath;
    this.header = header;
    this.type = header.type;
    this.version = header.version;
    this.fileList = fileList;
    this.gnrlEntries = gnrlEntries;
    this.dx10Entries = dx10Entries;
  }

  async extractAll(outputPath: string): Promise<void> {
    const fd = await fs.promises.open(this.filePath, "r");
    try {
      if (this.type === "general") {
        await this.extractAllGeneral(fd, outputPath);
      } else {
        await this.extractAllDX10(fd, outputPath);
      }
    } finally {
      await fd.close();
    }
  }

  private async extractAllGeneral(fd: fs.promises.FileHandle, outputPath: string): Promise<void> {
    const entries = this.gnrlEntries!;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const name = this.fileList[i];
      const outFile = path.join(outputPath, name);

      await fs.promises.mkdir(path.dirname(outFile), { recursive: true });

      const isCompressed = entry.packedLen !== 0 && entry.packedLen !== entry.unpackedLen;
      const readLen = isCompressed ? entry.packedLen : entry.unpackedLen;

      if (readLen === 0) {
        // Empty file
        await fs.promises.writeFile(outFile, Buffer.alloc(0));
        continue;
      }

      const buf = Buffer.alloc(readLen);
      await fd.read(buf, 0, readLen, entry.offset);

      if (isCompressed) {
        const decompressed = inflateSync(buf);
        await fs.promises.writeFile(outFile, decompressed);
      } else {
        await fs.promises.writeFile(outFile, buf);
      }
    }
  }

  private async extractAllDX10(fd: fs.promises.FileHandle, outputPath: string): Promise<void> {
    const entries = this.dx10Entries!;

    for (let i = 0; i < entries.length; i++) {
      const tex = entries[i];
      const name = this.fileList[i];
      const outFile = path.join(outputPath, name);

      await fs.promises.mkdir(path.dirname(outFile), { recursive: true });

      // Build DDS header
      const ddsHeader = buildDDSHeader(tex);
      const chunks: Buffer[] = [ddsHeader];

      // Extract and decompress each chunk
      for (const chunk of tex.chunks) {
        const isCompressed = chunk.packedLen !== 0 && chunk.packedLen !== chunk.unpackedLen;
        const readLen = isCompressed ? chunk.packedLen : chunk.unpackedLen;

        const buf = Buffer.alloc(readLen);
        await fd.read(buf, 0, readLen, chunk.offset);

        if (isCompressed) {
          chunks.push(inflateSync(buf));
        } else {
          chunks.push(buf);
        }
      }

      await fs.promises.writeFile(outFile, Buffer.concat(chunks));
    }
  }
}

export async function loadBA2(fileName: string): Promise<BA2Archive> {
  const fd = await fs.promises.open(fileName, "r");
  try {
    // Read header
    const headerBuf = Buffer.alloc(HEADER_SIZE);
    await fd.read(headerBuf, 0, HEADER_SIZE, 0);

    const magic = headerBuf.toString("ascii", 0, 4);
    if (magic !== BA2_MAGIC) {
      throw new Error(`Invalid BA2 file: expected magic "BTDX", got "${magic}"`);
    }

    const version = headerBuf.readUInt32LE(4);
    const typeStr = headerBuf.toString("ascii", 8, 12);
    const fileCount = headerBuf.readUInt32LE(12);
    const nameTableOffset = Number(headerBuf.readBigUInt64LE(16));

    let type: "general" | "dx10";
    if (typeStr === "GNRL") {
      type = "general";
    } else if (typeStr === "DX10") {
      type = "dx10";
    } else {
      throw new Error(`Unknown BA2 type: "${typeStr}"`);
    }

    const header: BA2Header = { version, type, fileCount, nameTableOffset };

    // Read file entries
    let gnrlEntries: GnrlFileEntry[] | undefined;
    let dx10Entries: DX10TextureEntry[] | undefined;

    if (type === "general") {
      gnrlEntries = await readGnrlEntries(fd, fileCount);
    } else {
      dx10Entries = await readDX10Entries(fd, fileCount);
    }

    // Read name table
    const stat = await fd.stat();
    const nameTableLen = stat.size - nameTableOffset;
    const nameTableBuf = Buffer.alloc(nameTableLen);
    await fd.read(nameTableBuf, 0, nameTableLen, nameTableOffset);
    const fileList = parseNameTable(nameTableBuf, fileCount);

    return new BA2Archive(fileName, header, fileList, gnrlEntries, dx10Entries);
  } finally {
    await fd.close();
  }
}

// --- Internal parsing ---

async function readGnrlEntries(
  fd: fs.promises.FileHandle,
  fileCount: number,
): Promise<GnrlFileEntry[]> {
  const totalSize = fileCount * GNRL_ENTRY_SIZE;
  const buf = Buffer.alloc(totalSize);
  await fd.read(buf, 0, totalSize, HEADER_SIZE);

  const entries: GnrlFileEntry[] = [];
  for (let i = 0; i < fileCount; i++) {
    const off = i * GNRL_ENTRY_SIZE;
    entries.push({
      nameHash: buf.readUInt32LE(off),
      ext: buf.toString("ascii", off + 4, off + 8).replace(/\0/g, ""),
      dirHash: buf.readUInt32LE(off + 8),
      flags: buf.readUInt32LE(off + 12),
      offset: Number(buf.readBigUInt64LE(off + 16)),
      packedLen: buf.readUInt32LE(off + 24),
      unpackedLen: buf.readUInt32LE(off + 28),
    });
  }
  return entries;
}

async function readDX10Entries(
  fd: fs.promises.FileHandle,
  fileCount: number,
): Promise<DX10TextureEntry[]> {
  // DX10 entries are variable-length, so we need to read them one at a time
  // First, estimate a generous buffer: each entry is at least 24 bytes header
  // + chunks. Read a large enough chunk.
  // Max reasonable: 24 + 255*24 = 6144 bytes per entry
  const maxEntrySize = 24 + 255 * 24;
  const bufSize = Math.min(fileCount * maxEntrySize, 10 * 1024 * 1024);
  const buf = Buffer.alloc(bufSize);
  await fd.read(buf, 0, bufSize, HEADER_SIZE);

  const entries: DX10TextureEntry[] = [];
  let off = 0;

  for (let i = 0; i < fileCount; i++) {
    const numChunks = buf[off + 0x0d];
    const chunkHdrLen = buf.readUInt16LE(off + 0x0e);

    const entry: DX10TextureEntry = {
      nameHash: buf.readUInt32LE(off),
      ext: buf.toString("ascii", off + 4, off + 8).replace(/\0/g, ""),
      dirHash: buf.readUInt32LE(off + 8),
      numChunks,
      chunkHdrLen,
      height: buf.readUInt16LE(off + 0x10),
      width: buf.readUInt16LE(off + 0x12),
      numMips: buf[off + 0x14],
      dxgiFormat: buf[off + 0x15],
      chunks: [],
    };
    off += 24;

    for (let j = 0; j < numChunks; j++) {
      entry.chunks.push({
        offset: Number(buf.readBigUInt64LE(off)),
        packedLen: buf.readUInt32LE(off + 8),
        unpackedLen: buf.readUInt32LE(off + 12),
        startMip: buf.readUInt16LE(off + 16),
        endMip: buf.readUInt16LE(off + 18),
      });
      off += 24;
    }

    entries.push(entry);
  }

  return entries;
}

function parseNameTable(buf: Buffer, expectedCount: number): string[] {
  const names: string[] = [];
  let off = 0;

  while (off + 2 <= buf.length && names.length < expectedCount) {
    const len = buf.readUInt16LE(off);
    off += 2;
    if (off + len > buf.length) break;
    names.push(buf.toString("ascii", off, off + len));
    off += len;
  }

  return names;
}

// --- DDS header construction ---

function buildDDSHeader(tex: DX10TextureEntry): Buffer {
  const formatInfo = DXGI_FORMAT_MAP.get(tex.dxgiFormat);
  const useFourCC = formatInfo?.fourCC !== undefined;

  // DDS magic (4) + DDS_HEADER (124) = 128 bytes
  const buf = Buffer.alloc(128);
  buf.writeUInt32LE(DDS_MAGIC, 0);

  // DDS_HEADER at offset 4
  const h = 4;
  buf.writeUInt32LE(DDS_HEADER_SIZE, h); // dwSize
  buf.writeUInt32LE(DDS_HEADER_FLAGS, h + 4); // dwFlags
  buf.writeUInt32LE(tex.height, h + 8); // dwHeight
  buf.writeUInt32LE(tex.width, h + 12); // dwWidth
  // dwPitchOrLinearSize at h+16 (leave 0)
  // dwDepth at h+20 (leave 0)
  buf.writeUInt32LE(tex.numMips, h + 24); // dwMipMapCount
  // dwReserved1[11] at h+28 (leave 0)

  // DDS_PIXELFORMAT at h+72
  const pf = h + 72;
  buf.writeUInt32LE(DDS_PIXELFORMAT_SIZE, pf); // dwSize

  if (useFourCC) {
    buf.writeUInt32LE(DDPF_FOURCC, pf + 4); // dwFlags
    buf.write(formatInfo!.fourCC!, pf + 8, 4, "ascii"); // dwFourCC
  } else if (formatInfo) {
    buf.writeUInt32LE(formatInfo.flags ?? 0, pf + 4);
    buf.writeUInt32LE(formatInfo.bpp, pf + 12); // dwRGBBitCount
    buf.writeUInt32LE(formatInfo.rMask ?? 0, pf + 16);
    buf.writeUInt32LE(formatInfo.gMask ?? 0, pf + 20);
    buf.writeUInt32LE(formatInfo.bMask ?? 0, pf + 24);
    buf.writeUInt32LE(formatInfo.aMask ?? 0, pf + 28);
  }

  // dwCaps at h+104
  buf.writeUInt32LE(DDS_SURFACE_FLAGS, h + 104);

  return buf;
}
