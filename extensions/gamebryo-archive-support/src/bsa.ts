import * as fs from "fs";
import * as path from "path";
import { inflateSync } from "zlib";

import * as lz4js from "lz4js";

// LZ4 frame magic number
const LZ4_FRAME_MAGIC = 0x184d2204;

function decompressBSA(compressedBuf: Buffer): Buffer {
  // Detect compression format from magic bytes
  if (compressedBuf.length >= 4 && compressedBuf.readUInt32LE(0) === LZ4_FRAME_MAGIC) {
    // LZ4 frame format (Skyrim SE)
    const result = lz4js.decompress(new Uint8Array(compressedBuf));
    return Buffer.from(result);
  }
  // zlib/deflate (Oblivion, FO3, FNV, Skyrim LE)
  return inflateSync(compressedBuf);
}

// --- BSA Format Constants ---

const BSA_MAGIC = "BSA\0";
const BSA_HEADER_SIZE = 36;

const FLAG_HASDIRNAMES = 0x00000001;
const FLAG_HASFILENAMES = 0x00000002;
const FLAG_DEFAULTCOMPRESSED = 0x00000004;
const FLAG_NAMEPREFIXED = 0x00000100;

type BSAVersion = 0x67 | 0x68 | 0x69;

const VERSION_OBLIVION: BSAVersion = 0x67;
const VERSION_FALLOUT3: BSAVersion = 0x68; // also FNV, Skyrim LE
const VERSION_SKYRIMSE: BSAVersion = 0x69;

// --- Types ---

interface BSAHeader {
  version: BSAVersion;
  archiveFlags: number;
  folderCount: number;
  fileCount: number;
  totalFolderNameLength: number;
  totalFileNameLength: number;
  fileFlags: number;
}

interface FolderRecord {
  nameHash: bigint;
  fileCount: number;
  offset: number;
}

interface FileRecord {
  nameHash: bigint;
  size: number;
  dataOffset: number;
  compressToggled: boolean;
}

interface BSAFileEntry {
  name: string;
  folderPath: string;
  fullPath: string;
  size: number;
  dataOffset: number;
  compressToggled: boolean;
}

interface BSAFolderEntry {
  name: string;
  files: BSAFileEntry[];
  subFolders: BSAFolderEntry[];
}

// --- BSA Hash Algorithm ---

function genHashInt(data: Uint8Array, start: number, end: number): number {
  let hash = 0;
  for (let i = start; i < end; i++) {
    hash = Math.imul(hash, 0x1003f) + data[i];
    hash = hash >>> 0; // keep as uint32
  }
  return hash;
}

export function calculateBSAHash(fileName: string): bigint {
  // Normalize: lowercase and replace / with backslash
  let lower = "";
  for (let i = 0; i < fileName.length; i++) {
    let ch = fileName.charCodeAt(i);
    if (ch >= 0x41 && ch <= 0x5a) ch += 0x20; // to lowercase
    if (ch === 0x2f) ch = 0x5c; // / -> backslash
    lower += String.fromCharCode(ch);
  }

  const bytes = new Uint8Array(lower.length);
  for (let i = 0; i < lower.length; i++) {
    bytes[i] = lower.charCodeAt(i);
  }

  // Find extension
  const dotIdx = lower.lastIndexOf(".");
  const extStart = dotIdx >= 0 ? dotIdx : lower.length;
  const stemLen = extStart;
  const ext = lower.substring(extStart);

  // Hash1 - lower 32 bits
  let hash1 = 0;
  if (stemLen > 0) {
    hash1 =
      bytes[stemLen - 1] |
      ((stemLen > 2 ? bytes[stemLen - 2] : 0) << 8) |
      (stemLen << 16) |
      (bytes[0] << 24);
    hash1 = hash1 >>> 0;
  }

  // Extension flags
  if (ext.length > 0) {
    const extBody = ext.substring(1); // without the dot
    if (extBody === "kf") hash1 |= 0x80;
    else if (extBody === "nif") hash1 |= 0x8000;
    else if (extBody === "dds") hash1 |= 0x8080;
    else if (extBody === "wav") hash1 |= 0x80000000;
    hash1 = hash1 >>> 0;

    // Hash2 - upper 32 bits
    // genHashInt from pos 1 to (extStart-2) - matches C++ pointer arithmetic (extU - 2)
    const h2a = genHashInt(bytes, 1, extStart - 2);
    // genHashInt of the extension (including the dot)
    const h2b = genHashInt(bytes, extStart, bytes.length);
    const hash2 = ((h2a + h2b) & 0xffffffff) >>> 0;

    return (BigInt(hash1 >>> 0) | (BigInt(hash2) << 32n)) & 0xffffffffffffffffn;
  }

  return BigInt(hash1 >>> 0);
}

// --- BSA Archive Class ---

export class BSAArchive {
  public readonly version: BSAVersion;
  public readonly archiveFlags: number;
  public readonly fileCount: number;
  public readonly folderTree: BSAFolderEntry;
  public readonly fileList: BSAFileEntry[];

  private filePath: string;
  private header: BSAHeader;

  constructor(
    filePath: string,
    header: BSAHeader,
    folderTree: BSAFolderEntry,
    fileList: BSAFileEntry[],
  ) {
    this.filePath = filePath;
    this.header = header;
    this.version = header.version;
    this.archiveFlags = header.archiveFlags;
    this.fileCount = fileList.length;
    this.folderTree = folderTree;
    this.fileList = fileList;
  }

  private defaultCompressed(): boolean {
    return (this.archiveFlags & FLAG_DEFAULTCOMPRESSED) !== 0;
  }

  private namePrefixed(): boolean {
    return this.version !== VERSION_OBLIVION && (this.archiveFlags & FLAG_NAMEPREFIXED) !== 0;
  }

  private isCompressed(file: BSAFileEntry): boolean {
    const dc = this.defaultCompressed();
    const toggle = file.compressToggled;
    return (dc && !toggle) || (!dc && toggle);
  }

  async extractFile(file: BSAFileEntry, outputPath: string): Promise<void> {
    const fd = await fs.promises.open(this.filePath, "r");
    try {
      let offset = file.dataOffset;

      // Skip name prefix if applicable
      if (this.namePrefixed()) {
        const lenBuf = Buffer.alloc(1);
        await fd.read(lenBuf, 0, 1, offset);
        const nameLen = lenBuf[0];
        offset += 1 + nameLen;
      }

      const outFile = path.join(outputPath, file.name);
      await fs.promises.mkdir(path.dirname(outFile), { recursive: true });

      if (this.isCompressed(file)) {
        // Compressed: first 4 bytes are the original uncompressed size
        const sizeBuf = Buffer.alloc(4);
        await fd.read(sizeBuf, 0, 4, offset);
        const origSize = sizeBuf.readUInt32LE(0);
        offset += 4;

        if (origSize === 0 || file.size === 0) {
          await fs.promises.writeFile(outFile, Buffer.alloc(0));
          return;
        }

        // file.size is total on-disk size INCLUDING the 4-byte prefix
        const compressedLen = file.size - 4;
        const compressedBuf = Buffer.alloc(compressedLen);
        await fd.read(compressedBuf, 0, compressedLen, offset);
        const decompressed = decompressBSA(compressedBuf);
        await fs.promises.writeFile(outFile, decompressed);
      } else {
        if (file.size === 0) {
          await fs.promises.writeFile(outFile, Buffer.alloc(0));
          return;
        }
        const buf = Buffer.alloc(file.size);
        await fd.read(buf, 0, file.size, offset);
        await fs.promises.writeFile(outFile, buf);
      }
    } finally {
      await fd.close();
    }
  }

  async extractAll(outputPath: string): Promise<void> {
    const fd = await fs.promises.open(this.filePath, "r");
    try {
      for (const file of this.fileList) {
        let offset = file.dataOffset;

        // Skip name prefix if applicable
        if (this.namePrefixed()) {
          const lenBuf = Buffer.alloc(1);
          await fd.read(lenBuf, 0, 1, offset);
          const nameLen = lenBuf[0];
          offset += 1 + nameLen;
        }

        const outFile = path.join(outputPath, file.fullPath);
        await fs.promises.mkdir(path.dirname(outFile), { recursive: true });

        if (this.isCompressed(file)) {
          const sizeBuf = Buffer.alloc(4);
          await fd.read(sizeBuf, 0, 4, offset);
          const origSize = sizeBuf.readUInt32LE(0);
          offset += 4;

          if (origSize === 0 || file.size === 0) {
            await fs.promises.writeFile(outFile, Buffer.alloc(0));
            continue;
          }

          // file.size is total on-disk size INCLUDING the 4-byte prefix
          const compressedLen = file.size - 4;
          const compressedBuf = Buffer.alloc(compressedLen);
          await fd.read(compressedBuf, 0, compressedLen, offset);
          const decompressed = decompressBSA(compressedBuf);
          await fs.promises.writeFile(outFile, decompressed);
        } else {
          if (file.size === 0) {
            await fs.promises.writeFile(outFile, Buffer.alloc(0));
            continue;
          }
          const buf = Buffer.alloc(file.size);
          await fd.read(buf, 0, file.size, offset);
          await fs.promises.writeFile(outFile, buf);
        }
      }
    } finally {
      await fd.close();
    }
  }
}

// --- Loading ---

export async function loadBSA(fileName: string, verify: boolean = false): Promise<BSAArchive> {
  const fd = await fs.promises.open(fileName, "r");
  try {
    // Read header
    const headerBuf = Buffer.alloc(BSA_HEADER_SIZE);
    await fd.read(headerBuf, 0, BSA_HEADER_SIZE, 0);

    const magic = headerBuf.toString("ascii", 0, 4);
    if (magic !== BSA_MAGIC) {
      throw new Error(
        `Invalid BSA file: expected magic "BSA\\0", got "${magic.replace(/\0/g, "\\0")}"`,
      );
    }

    const versionRaw = headerBuf.readUInt32LE(4);
    if (versionRaw !== 0x67 && versionRaw !== 0x68 && versionRaw !== 0x69) {
      throw new Error(`Unsupported BSA version: 0x${versionRaw.toString(16)}`);
    }
    const version = versionRaw as BSAVersion;

    const header: BSAHeader = {
      version,
      archiveFlags: headerBuf.readUInt32LE(12),
      folderCount: headerBuf.readUInt32LE(16),
      fileCount: headerBuf.readUInt32LE(20),
      totalFolderNameLength: headerBuf.readUInt32LE(24),
      totalFileNameLength: headerBuf.readUInt32LE(28),
      fileFlags: headerBuf.readUInt32LE(32),
    };

    const isSkyrimSE = version === VERSION_SKYRIMSE;

    // Read folder records
    const folderRecordSize = isSkyrimSE ? 24 : 16;
    const folderRecordsBufSize = header.folderCount * folderRecordSize;
    const folderRecordsBuf = Buffer.alloc(folderRecordsBufSize);
    await fd.read(folderRecordsBuf, 0, folderRecordsBufSize, BSA_HEADER_SIZE);

    const folderRecords: FolderRecord[] = [];
    for (let i = 0; i < header.folderCount; i++) {
      const off = i * folderRecordSize;
      const nameHash = folderRecordsBuf.readBigUInt64LE(off);
      let fileCount: number;
      let offset: number;
      if (isSkyrimSE) {
        // SSE layout: hash(8) + count(4) + padding(4) + offset(8) = 24
        // C++ reads count as uint64 then truncates to uint32
        fileCount = folderRecordsBuf.readUInt32LE(off + 8);
        offset = Number(folderRecordsBuf.readBigUInt64LE(off + 16));
      } else {
        fileCount = folderRecordsBuf.readUInt32LE(off + 8);
        offset = folderRecordsBuf.readUInt32LE(off + 12);
      }
      folderRecords.push({ nameHash, fileCount, offset });
    }

    // Parse folder data using absolute offsets from folder records.
    // Each folder record's offset points to (folderDataPosition + totalFileNameLength).
    // So actual data position = offset - totalFileNameLength.
    // At each position: BString(folder name) + fileCount * 16-byte file records.

    const fileRecordSize = 16; // hash(8) + size(4) + offset(4)

    interface ParsedFolder {
      name: string;
      nameHash: bigint;
      files: FileRecord[];
    }

    const parsedFolders: ParsedFolder[] = [];

    // Calculate how much data we need to read for all folder data
    // Find min and max offsets to determine the range
    let minOffset = Infinity;
    let maxEnd = 0;
    for (const fr of folderRecords) {
      const dataPos = fr.offset - header.totalFileNameLength;
      if (dataPos < minOffset) minOffset = dataPos;
      // Estimate end: name (up to 256 bytes) + file records
      const estEnd = dataPos + 257 + fr.fileCount * fileRecordSize;
      if (estEnd > maxEnd) maxEnd = estEnd;
    }

    // Read the entire folder data block at once
    const folderDataBufSize = maxEnd - minOffset;
    const folderDataBuf = Buffer.alloc(folderDataBufSize);
    await fd.read(folderDataBuf, 0, folderDataBufSize, minOffset);

    let fileNameBlockOffset = 0;

    for (const fr of folderRecords) {
      const dataPos = fr.offset - header.totalFileNameLength;
      let off = dataPos - minOffset;

      // Read B-string: 1 byte length, then that many chars (including null terminator)
      const nameLen = folderDataBuf[off];
      off += 1;
      // The name includes the null terminator in the length count
      const name = folderDataBuf.toString("ascii", off, off + nameLen - 1).replace(/\0/g, "");
      off += nameLen;

      // Read file records
      const files: FileRecord[] = [];
      for (let j = 0; j < fr.fileCount; j++) {
        const nameHash = folderDataBuf.readBigUInt64LE(off);
        let size = folderDataBuf.readUInt32LE(off + 8);
        const dataOffset = folderDataBuf.readUInt32LE(off + 12);
        let compressToggled = false;
        if ((size & (1 << 30)) !== 0) {
          compressToggled = true;
          size ^= 1 << 30;
        }
        files.push({ nameHash, size, dataOffset, compressToggled });
        off += fileRecordSize;
      }

      // Track the end position for file name block calculation
      const endPos = minOffset + off;
      if (endPos > fileNameBlockOffset) fileNameBlockOffset = endPos;

      parsedFolders.push({ name, nameHash: fr.nameHash, files });
    }

    // Read file names block (starts right after the last folder data)
    const fileNamesBuf = Buffer.alloc(header.totalFileNameLength);
    await fd.read(fileNamesBuf, 0, header.totalFileNameLength, fileNameBlockOffset);

    // Parse file names (null-terminated strings)
    const fileNames: string[] = [];
    let fnOff = 0;
    for (let i = 0; i < header.fileCount; i++) {
      let end = fnOff;
      while (end < fileNamesBuf.length && fileNamesBuf[end] !== 0) end++;
      fileNames.push(fileNamesBuf.toString("ascii", fnOff, end));
      fnOff = end + 1;
    }

    // Verify hashes if requested
    if (verify) {
      let fileIdx = 0;
      for (const pf of parsedFolders) {
        for (const fr of pf.files) {
          const fname = fileNames[fileIdx];
          const expectedHash = calculateBSAHash(fname);
          if (expectedHash !== fr.nameHash) {
            throw new Error(
              `Hash mismatch for "${fname}": expected ${expectedHash.toString(16)}, got ${fr.nameHash.toString(16)}`,
            );
          }
          fileIdx++;
        }
      }
    }

    // Build folder tree and flat file list
    const fileList: BSAFileEntry[] = [];
    const rootFolder: BSAFolderEntry = { name: "", files: [], subFolders: [] };
    let globalFileIdx = 0;

    for (const pf of parsedFolders) {
      // Create folder node in tree
      const folderNode: BSAFolderEntry = {
        name: pf.name,
        files: [],
        subFolders: [],
      };

      for (const fr of pf.files) {
        const fileName = fileNames[globalFileIdx++];
        const entry: BSAFileEntry = {
          name: fileName,
          folderPath: pf.name,
          fullPath: pf.name ? pf.name + "\\" + fileName : fileName,
          size: fr.size,
          dataOffset: fr.dataOffset,
          compressToggled: fr.compressToggled,
        };
        folderNode.files.push(entry);
        fileList.push(entry);
      }

      // Insert into tree by splitting the path
      insertFolderIntoTree(rootFolder, pf.name, folderNode);
    }

    return new BSAArchive(fileName, header, rootFolder, fileList);
  } finally {
    await fd.close();
  }
}

function insertFolderIntoTree(
  root: BSAFolderEntry,
  folderPath: string,
  folderNode: BSAFolderEntry,
): void {
  if (!folderPath) {
    // Root level files
    root.files.push(...folderNode.files);
    return;
  }

  const parts = folderPath.split("\\");

  let current = root;
  for (let i = 0; i < parts.length - 1; i++) {
    let found = current.subFolders.find((sf) => sf.name.toLowerCase() === parts[i].toLowerCase());
    if (!found) {
      found = { name: parts[i], files: [], subFolders: [] };
      current.subFolders.push(found);
    }
    current = found;
  }

  // The last part is the actual folder name
  const lastPart = parts[parts.length - 1];
  let existing = current.subFolders.find((sf) => sf.name.toLowerCase() === lastPart.toLowerCase());
  if (existing) {
    existing.files.push(...folderNode.files);
  } else {
    const newFolder: BSAFolderEntry = {
      name: lastPart,
      files: folderNode.files,
      subFolders: [],
    };
    current.subFolders.push(newFolder);
  }
}

// --- BSA Creation ---

export async function createBSA(
  fileName: string,
  version: BSAVersion = VERSION_FALLOUT3,
): Promise<BSAWriter> {
  return new BSAWriter(fileName, version);
}

interface PendingFile {
  folderPath: string;
  fileName: string;
  sourcePath: string;
}

export class BSAWriter {
  private filePath: string;
  private version: BSAVersion;
  private pendingFiles: PendingFile[] = [];

  constructor(filePath: string, version: BSAVersion) {
    this.filePath = filePath;
    this.version = version;
  }

  addFile(archivePath: string, sourcePath: string): void {
    const sep = archivePath.lastIndexOf("\\");
    const folderPath = sep >= 0 ? archivePath.substring(0, sep) : "";
    const fileName = sep >= 0 ? archivePath.substring(sep + 1) : archivePath;
    this.pendingFiles.push({ folderPath, fileName, sourcePath });
  }

  async write(): Promise<void> {
    // Group files by folder
    const folderMap = new Map<string, PendingFile[]>();
    for (const pf of this.pendingFiles) {
      const key = pf.folderPath.toLowerCase();
      if (!folderMap.has(key)) folderMap.set(key, []);
      folderMap.get(key)!.push(pf);
    }

    const folders = Array.from(folderMap.entries()).map(([key, files]) => ({
      path: files[0].folderPath,
      files,
    }));

    // Calculate layout
    const archiveFlags = FLAG_HASDIRNAMES | FLAG_HASFILENAMES;
    const folderCount = folders.length;
    const fileCount = this.pendingFiles.length;

    // Folder names length (each includes null terminator for B-string)
    let totalFolderNameLength = 0;
    for (const f of folders) {
      totalFolderNameLength += f.path.length;
    }

    // File names length
    let totalFileNameLength = 0;
    for (const f of folders) {
      for (const pf of f.files) {
        totalFileNameLength += pf.fileName.length + 1; // null terminated
      }
    }

    // Determine file flags
    let fileFlags = 0;
    for (const pf of this.pendingFiles) {
      const ext = path.extname(pf.fileName).toLowerCase();
      if (ext === ".nif") fileFlags |= 1 << 0;
      else if (ext === ".dds") fileFlags |= 1 << 1;
      else if (ext === ".xml") fileFlags |= 1 << 2;
      else if (ext === ".wav") fileFlags |= 1 << 3;
      else if (ext === ".mp3") fileFlags |= 1 << 4;
      else if (ext === ".txt") fileFlags |= 1 << 5;
      else if (ext === ".spt") fileFlags |= 1 << 6;
      else if (ext === ".tex") fileFlags |= 1 << 7;
      else if (ext === ".ctl") fileFlags |= 1 << 8;
    }

    // Layout:
    // 1. Header (36 bytes)
    // 2. Folder records (folderCount * 16 bytes)
    // 3. Folder data: for each folder: BString name + file records
    // 4. File names block
    // 5. File data

    const folderRecordSize = 16; // always 16 for writing (we don't write SkyrimSE format)
    const fileRecordSize = 16;
    const folderRecordsStart = BSA_HEADER_SIZE;
    const folderDataStart = folderRecordsStart + folderCount * folderRecordSize;

    // Calculate folder data sizes
    let folderDataSize = 0;
    for (const f of folders) {
      folderDataSize += 1 + f.path.length + 1; // B-string: len byte + chars + null
      folderDataSize += f.files.length * fileRecordSize;
    }

    const fileNamesStart = folderDataStart + folderDataSize;
    const fileDataStart = fileNamesStart + totalFileNameLength;

    // Read all source files
    const fileData: Buffer[] = [];
    const fileSizes: number[] = [];
    let currentDataOffset = fileDataStart;
    const fileDataOffsets: number[] = [];

    for (const f of folders) {
      for (const pf of f.files) {
        const content = await fs.promises.readFile(pf.sourcePath);
        fileData.push(content);
        fileSizes.push(content.length);
        fileDataOffsets.push(currentDataOffset);
        currentDataOffset += content.length;
      }
    }

    // Build the output buffer
    const totalSize = currentDataOffset;
    const buf = Buffer.alloc(totalSize);

    // Write header
    buf.write("BSA\0", 0, 4, "ascii");
    buf.writeUInt32LE(this.version, 4);
    buf.writeUInt32LE(0x24, 8); // header offset constant
    buf.writeUInt32LE(archiveFlags, 12);
    buf.writeUInt32LE(folderCount, 16);
    buf.writeUInt32LE(fileCount, 20);
    buf.writeUInt32LE(totalFolderNameLength, 24);
    buf.writeUInt32LE(totalFileNameLength, 28);
    buf.writeUInt32LE(fileFlags, 32);

    // Write folder records and folder data
    let folderRecordOff = folderRecordsStart;
    let folderDataOff = folderDataStart;
    let globalFileIdx = 0;

    for (const f of folders) {
      const folderHash = calculateBSAHash(f.path);

      // Write folder record
      buf.writeBigUInt64LE(folderHash, folderRecordOff);
      buf.writeUInt32LE(f.files.length, folderRecordOff + 8);
      // Offset points to the folder data including the totalFileNameLength
      buf.writeUInt32LE(folderDataOff + totalFileNameLength, folderRecordOff + 12);
      folderRecordOff += folderRecordSize;

      // Write folder data: B-string name
      const nameBytes = f.path.length + 1; // include null terminator
      buf[folderDataOff] = nameBytes;
      folderDataOff += 1;
      buf.write(f.path, folderDataOff, f.path.length, "ascii");
      folderDataOff += f.path.length;
      buf[folderDataOff] = 0; // null terminator
      folderDataOff += 1;

      // Write file records
      for (const pf of f.files) {
        const fileHash = calculateBSAHash(pf.fileName);
        buf.writeBigUInt64LE(fileHash, folderDataOff);
        buf.writeUInt32LE(fileSizes[globalFileIdx], folderDataOff + 8);
        buf.writeUInt32LE(fileDataOffsets[globalFileIdx], folderDataOff + 12);
        folderDataOff += fileRecordSize;
        globalFileIdx++;
      }
    }

    // Write file names
    let fileNameOff = fileNamesStart;
    for (const f of folders) {
      for (const pf of f.files) {
        buf.write(pf.fileName, fileNameOff, pf.fileName.length, "ascii");
        fileNameOff += pf.fileName.length;
        buf[fileNameOff] = 0; // null terminator
        fileNameOff += 1;
      }
    }

    // Write file data
    globalFileIdx = 0;
    for (const data of fileData) {
      data.copy(buf, fileDataOffsets[globalFileIdx]);
      globalFileIdx++;
    }

    await fs.promises.writeFile(this.filePath, buf);
  }
}
