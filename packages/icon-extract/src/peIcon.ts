/**
 * Pure TypeScript PE icon resource extractor.
 *
 * Parses Windows PE (Portable Executable) files to extract embedded icon
 * resources without native addons. Follows the PE/COFF spec for resource
 * directory navigation and ICO/BMP icon data extraction.
 *
 * ## PE resource layout for icons
 *
 * The resource directory tree has three levels: Type -> Name -> Language.
 * Icons use two resource types:
 *
 *   RT_GROUP_ICON (14): Contains a GRPICONDIR header listing all available
 *   icon variants (sizes, color depths) with ordinal IDs pointing to the
 *   corresponding RT_ICON entries.
 *
 *   RT_ICON (3): Contains the actual icon image data for each variant.
 *   Each entry is either a BMP DIB (BITMAPINFOHEADER + pixel data) or a
 *   PNG-compressed image (starts with PNG signature 0x89504E47).
 *
 * ## Extraction flow
 *
 *   1. Parse PE headers -> locate resource section
 *   2. Navigate resource tree to find RT_GROUP_ICON entries
 *   3. Parse GRPICONDIR to find the best size match
 *   4. Navigate resource tree to find the matching RT_ICON entry
 *   5. Extract raw icon data (PNG or DIB)
 *   6. If DIB, convert to PNG; if already PNG, use directly
 */

import * as fs from "fs";
import { deflateSync, crc32 } from "zlib";

// --- PE constants ---

const PE_SIGNATURE = 0x00004550; // "PE\0\0"
const PE32_MAGIC = 0x10b;
const PE32PLUS_MAGIC = 0x20b;
const RT_ICON = 3;
const RT_GROUP_ICON = 14;
const PNG_SIGNATURE = 0x89504e47;

// --- Types ---

interface SectionInfo {
  buf: Buffer;
  sectionVA: number;
  resourceRVA: number;
}

interface GrpIconDirEntry {
  bWidth: number;
  bHeight: number;
  bColorCount: number;
  wPlanes: number;
  wBitCount: number;
  dwBytesInRes: number;
  nId: number;
}

interface ResourceDataEntry {
  dataRVA: number;
  dataSize: number;
}

// --- PE parsing ---

function findResourceSection(fd: number): SectionInfo | undefined {
  const dosHeader = Buffer.alloc(64);
  fs.readSync(fd, dosHeader, 0, 64, 0);
  if (dosHeader.readUInt16LE(0) !== 0x5a4d) return undefined; // "MZ"

  const peOffset = dosHeader.readUInt32LE(0x3c);
  const peHeader = Buffer.alloc(264);
  fs.readSync(fd, peHeader, 0, 264, peOffset);

  if (peHeader.readUInt32LE(0) !== PE_SIGNATURE) return undefined;

  const numberOfSections = peHeader.readUInt16LE(6);
  const sizeOfOptionalHeader = peHeader.readUInt16LE(20);

  const optMagic = peHeader.readUInt16LE(24);
  let dataDirOffset: number;
  if (optMagic === PE32_MAGIC) {
    dataDirOffset = 24 + 96;
  } else if (optMagic === PE32PLUS_MAGIC) {
    dataDirOffset = 24 + 112;
  } else {
    return undefined;
  }

  // Resource directory is data directory index 2
  const resourceRVA = peHeader.readUInt32LE(dataDirOffset + 2 * 8);
  const resourceSize = peHeader.readUInt32LE(dataDirOffset + 2 * 8 + 4);
  if (resourceRVA === 0 || resourceSize === 0) return undefined;

  // Read section headers
  const sectionsOffset = peOffset + 24 + sizeOfOptionalHeader;
  const sectionsSize = numberOfSections * 40;
  const sections = Buffer.alloc(sectionsSize);
  fs.readSync(fd, sections, 0, sectionsSize, sectionsOffset);

  for (let i = 0; i < numberOfSections; i++) {
    const sectionVA = sections.readUInt32LE(i * 40 + 12);
    const rawSize = sections.readUInt32LE(i * 40 + 16);
    const rawOffset = sections.readUInt32LE(i * 40 + 20);
    const virtualSize = sections.readUInt32LE(i * 40 + 8);
    const endVA = sectionVA + Math.max(rawSize, virtualSize);

    if (resourceRVA >= sectionVA && resourceRVA < endVA) {
      const readSize = Math.min(rawSize, 20 * 1024 * 1024); // cap at 20MB for icon resources
      const buf = Buffer.alloc(readSize);
      fs.readSync(fd, buf, 0, readSize, rawOffset);
      return { buf, sectionVA, resourceRVA };
    }
  }

  return undefined;
}

// --- Resource directory navigation ---

function findResourceTypeEntries(
  buf: Buffer,
  baseOffset: number,
  resourceType: number,
): number | undefined {
  const numberOfNamedEntries = buf.readUInt16LE(baseOffset + 12);
  const numberOfIdEntries = buf.readUInt16LE(baseOffset + 14);
  const totalEntries = numberOfNamedEntries + numberOfIdEntries;

  for (let i = 0; i < totalEntries; i++) {
    const entryOffset = baseOffset + 16 + i * 8;
    const nameOrId = buf.readUInt32LE(entryOffset);
    const offsetOrData = buf.readUInt32LE(entryOffset + 4);

    if (nameOrId === resourceType && offsetOrData & 0x80000000) {
      return offsetOrData & 0x7fffffff;
    }
  }

  return undefined;
}

/** Collect all data entries under a resource type subtree, keyed by their name/ID. */
function collectDataEntries(buf: Buffer, dirOffset: number): Map<number, ResourceDataEntry> {
  const entries = new Map<number, ResourceDataEntry>();
  const numberOfNamedEntries = buf.readUInt16LE(dirOffset + 12);
  const numberOfIdEntries = buf.readUInt16LE(dirOffset + 14);
  const totalEntries = numberOfNamedEntries + numberOfIdEntries;

  for (let i = 0; i < totalEntries; i++) {
    const entryOffset = dirOffset + 16 + i * 8;
    const nameOrId = buf.readUInt32LE(entryOffset);
    const offsetOrData = buf.readUInt32LE(entryOffset + 4);

    const dataEntry = resolveToDataEntry(buf, offsetOrData);
    if (dataEntry !== undefined) {
      entries.set(nameOrId, dataEntry);
    }
  }

  return entries;
}

function resolveToDataEntry(buf: Buffer, offsetOrData: number): ResourceDataEntry | undefined {
  if (offsetOrData & 0x80000000) {
    // Subdirectory — take the first entry and recurse
    const subDirOffset = offsetOrData & 0x7fffffff;
    const subNamedCount = buf.readUInt16LE(subDirOffset + 12);
    const subIdCount = buf.readUInt16LE(subDirOffset + 14);
    if (subNamedCount + subIdCount === 0) return undefined;

    const firstSubEntry = subDirOffset + 16;
    const firstSubData = buf.readUInt32LE(firstSubEntry + 4);
    return resolveToDataEntry(buf, firstSubData);
  }

  // Data entry: IMAGE_RESOURCE_DATA_ENTRY
  if (offsetOrData + 16 > buf.length) return undefined;
  return {
    dataRVA: buf.readUInt32LE(offsetOrData),
    dataSize: buf.readUInt32LE(offsetOrData + 4),
  };
}

// --- GRPICONDIR parsing ---

function parseGrpIconDir(data: Buffer): GrpIconDirEntry[] {
  // GRPICONDIR: idReserved(2) + idType(2) + idCount(2) + entries
  if (data.length < 6) return [];
  const idCount = data.readUInt16LE(4);
  const entries: GrpIconDirEntry[] = [];

  for (let i = 0; i < idCount; i++) {
    const offset = 6 + i * 14;
    if (offset + 14 > data.length) break;

    entries.push({
      bWidth: data.readUInt8(offset) || 256, // 0 means 256
      bHeight: data.readUInt8(offset + 1) || 256,
      bColorCount: data.readUInt8(offset + 2),
      wPlanes: data.readUInt16LE(offset + 4),
      wBitCount: data.readUInt16LE(offset + 6),
      dwBytesInRes: data.readUInt32LE(offset + 8),
      nId: data.readUInt16LE(offset + 12),
    });
  }

  return entries;
}

function selectBestIcon(
  entries: GrpIconDirEntry[],
  targetWidth: number,
): GrpIconDirEntry | undefined {
  if (entries.length === 0) return undefined;

  // Prefer exact match, then closest larger, then largest available
  // Among same-size entries, prefer higher bit count
  let best: GrpIconDirEntry | undefined;

  for (const entry of entries) {
    if (best === undefined) {
      best = entry;
      continue;
    }

    const bestDiff = Math.abs(best.bWidth - targetWidth);
    const entryDiff = Math.abs(entry.bWidth - targetWidth);

    if (entryDiff < bestDiff) {
      best = entry;
    } else if (entryDiff === bestDiff && entry.wBitCount > best.wBitCount) {
      best = entry;
    } else if (
      entryDiff === bestDiff &&
      entry.wBitCount === best.wBitCount &&
      entry.bWidth > best.bWidth
    ) {
      best = entry;
    }
  }

  return best;
}

// --- DIB to PNG conversion ---

function dibToPng(data: Buffer, declaredWidth: number, declaredHeight: number): Buffer {
  // Check if it's already PNG
  if (data.length >= 4 && data.readUInt32BE(0) === PNG_SIGNATURE) {
    return data;
  }

  // Parse BITMAPINFOHEADER (40 bytes minimum)
  if (data.length < 40) {
    throw new Error("icon data too small for BITMAPINFOHEADER");
  }

  const biSize = data.readUInt32LE(0);
  const biWidth = data.readInt32LE(4);
  // biHeight includes both XOR and AND masks, so actual height is half
  const biHeight = data.readInt32LE(8);
  const biBitCount = data.readUInt16LE(14);
  const biCompression = data.readUInt32LE(16);

  // For icons, height in the header is 2x (XOR mask + AND mask)
  const height = Math.abs(biHeight) / 2;
  const width = biWidth;

  if (width <= 0 || height <= 0 || width > 1024 || height > 1024) {
    throw new Error(`invalid icon dimensions: ${width}x${height}`);
  }

  if (biCompression !== 0) {
    throw new Error(`unsupported DIB compression: ${biCompression}`);
  }

  const rgba = Buffer.alloc(width * height * 4);

  if (biBitCount === 32) {
    decode32bpp(data, biSize, width, height, rgba);
  } else if (biBitCount === 24) {
    decode24bpp(data, biSize, width, height, rgba);
  } else if (biBitCount === 8) {
    decodeIndexed(data, biSize, width, height, 8, rgba);
  } else if (biBitCount === 4) {
    decodeIndexed(data, biSize, width, height, 4, rgba);
  } else if (biBitCount === 1) {
    decodeIndexed(data, biSize, width, height, 1, rgba);
  } else {
    throw new Error(`unsupported bit depth: ${biBitCount}`);
  }

  return encodePng(width, height, rgba);
}

function decode32bpp(
  data: Buffer,
  headerSize: number,
  width: number,
  height: number,
  rgba: Buffer,
): void {
  const pixelOffset = headerSize;
  const rowSize = width * 4;

  for (let y = 0; y < height; y++) {
    // DIB is stored bottom-up
    const srcRow = pixelOffset + (height - 1 - y) * rowSize;
    const dstRow = y * width * 4;

    for (let x = 0; x < width; x++) {
      const srcIdx = srcRow + x * 4;
      const dstIdx = dstRow + x * 4;
      // BGRA -> RGBA
      rgba[dstIdx] = data.readUInt8(srcIdx + 2);
      rgba[dstIdx + 1] = data.readUInt8(srcIdx + 1);
      rgba[dstIdx + 2] = data.readUInt8(srcIdx);
      rgba[dstIdx + 3] = data.readUInt8(srcIdx + 3);
    }
  }
}

function decode24bpp(
  data: Buffer,
  headerSize: number,
  width: number,
  height: number,
  rgba: Buffer,
): void {
  const pixelOffset = headerSize;
  const rowSize = Math.ceil((width * 3) / 4) * 4; // rows are DWORD-aligned

  // AND mask follows the pixel data
  const andMaskOffset = pixelOffset + rowSize * height;
  const andRowSize = Math.ceil(width / 32) * 4;

  for (let y = 0; y < height; y++) {
    const srcRow = pixelOffset + (height - 1 - y) * rowSize;
    const andRow = andMaskOffset + (height - 1 - y) * andRowSize;
    const dstRow = y * width * 4;

    for (let x = 0; x < width; x++) {
      const srcIdx = srcRow + x * 3;
      const dstIdx = dstRow + x * 4;
      // BGR -> RGBA
      rgba[dstIdx] = data.readUInt8(srcIdx + 2);
      rgba[dstIdx + 1] = data.readUInt8(srcIdx + 1);
      rgba[dstIdx + 2] = data.readUInt8(srcIdx);

      // AND mask: 1 = transparent, 0 = opaque
      if (andRow + (x >>> 3) < data.length) {
        const andBit = (data.readUInt8(andRow + (x >>> 3)) >> (7 - (x & 7))) & 1;
        rgba[dstIdx + 3] = andBit ? 0 : 255;
      } else {
        rgba[dstIdx + 3] = 255;
      }
    }
  }
}

function decodeIndexed(
  data: Buffer,
  headerSize: number,
  width: number,
  height: number,
  bitCount: number,
  rgba: Buffer,
): void {
  const numColors = 1 << bitCount;
  const paletteOffset = headerSize;
  const palette = new Uint8Array(numColors * 4);

  // Read color table (BGRX, 4 bytes each)
  for (let i = 0; i < numColors; i++) {
    const off = paletteOffset + i * 4;
    if (off + 4 > data.length) break;
    palette[i * 4] = data.readUInt8(off + 2); // R
    palette[i * 4 + 1] = data.readUInt8(off + 1); // G
    palette[i * 4 + 2] = data.readUInt8(off); // B
    palette[i * 4 + 3] = 255; // A
  }

  const pixelOffset = paletteOffset + numColors * 4;
  let rowBits: number;
  if (bitCount === 8) {
    rowBits = width;
  } else if (bitCount === 4) {
    rowBits = Math.ceil(width / 2);
  } else {
    rowBits = Math.ceil(width / 8);
  }
  const rowSize = Math.ceil(rowBits / 4) * 4; // DWORD-aligned

  // AND mask follows pixel data
  const andMaskOffset = pixelOffset + rowSize * height;
  const andRowSize = Math.ceil(width / 32) * 4;

  for (let y = 0; y < height; y++) {
    const srcRow = pixelOffset + (height - 1 - y) * rowSize;
    const andRow = andMaskOffset + (height - 1 - y) * andRowSize;
    const dstRow = y * width * 4;

    for (let x = 0; x < width; x++) {
      let colorIndex: number;
      if (bitCount === 8) {
        colorIndex = data.readUInt8(srcRow + x);
      } else if (bitCount === 4) {
        const byte = data.readUInt8(srcRow + (x >>> 1));
        colorIndex = x & 1 ? byte & 0x0f : (byte >> 4) & 0x0f;
      } else {
        // 1-bit
        const byte = data.readUInt8(srcRow + (x >>> 3));
        colorIndex = (byte >> (7 - (x & 7))) & 1;
      }

      const dstIdx = dstRow + x * 4;
      const palIdx = colorIndex * 4;
      rgba[dstIdx] = palette[palIdx]!;
      rgba[dstIdx + 1] = palette[palIdx + 1]!;
      rgba[dstIdx + 2] = palette[palIdx + 2]!;

      // AND mask
      if (andRow + (x >>> 3) < data.length) {
        const andBit = (data.readUInt8(andRow + (x >>> 3)) >> (7 - (x & 7))) & 1;
        rgba[dstIdx + 3] = andBit ? 0 : 255;
      } else {
        rgba[dstIdx + 3] = 255;
      }
    }
  }
}

// --- PNG encoder ---

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  // Build raw filtered scanlines: filter byte (0 = None) + row data
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // filter type: None
    rgba.copy(rawData, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = deflateSync(rawData);

  // IHDR data (13 bytes)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeChunk(type: string, data: Buffer): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeAndData.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + data.length);
  return chunk;
}

// --- Public API ---

export interface ExtractedIcon {
  width: number;
  height: number;
  png: Buffer;
}

/**
 * Extract the icon from a Windows PE executable.
 * Returns the icon as a PNG buffer, or undefined if no icon is found.
 */
export function extractIcon(filePath: string, width: number = 32): ExtractedIcon | undefined {
  let fd: number;
  try {
    fd = fs.openSync(filePath, "r");
  } catch {
    return undefined;
  }

  try {
    const section = findResourceSection(fd);
    if (section === undefined) return undefined;

    const { buf: sectionBuf, sectionVA, resourceRVA } = section;
    const resourceOffset = resourceRVA - sectionVA;

    // Find RT_GROUP_ICON entries
    const groupIconDirOffset = findResourceTypeEntries(sectionBuf, resourceOffset, RT_GROUP_ICON);
    if (groupIconDirOffset === undefined) return undefined;

    // Get all group icon entries (usually just one group)
    const groupEntries = collectDataEntries(sectionBuf, groupIconDirOffset);
    if (groupEntries.size === 0) return undefined;

    // Take the first group icon
    const firstGroup = groupEntries.values().next().value;
    if (firstGroup === undefined) return undefined;

    const groupDataOffset = firstGroup.dataRVA - sectionVA;
    if (groupDataOffset < 0 || groupDataOffset + firstGroup.dataSize > sectionBuf.length) {
      return undefined;
    }

    const groupData = sectionBuf.subarray(groupDataOffset, groupDataOffset + firstGroup.dataSize);
    const iconEntries = parseGrpIconDir(groupData);
    const bestEntry = selectBestIcon(iconEntries, width);
    if (bestEntry === undefined) return undefined;

    // Find RT_ICON entries
    const iconDirOffset = findResourceTypeEntries(sectionBuf, resourceOffset, RT_ICON);
    if (iconDirOffset === undefined) return undefined;

    const iconDataEntries = collectDataEntries(sectionBuf, iconDirOffset);
    const iconDataEntry = iconDataEntries.get(bestEntry.nId);
    if (iconDataEntry === undefined) return undefined;

    const iconDataOffset = iconDataEntry.dataRVA - sectionVA;
    if (iconDataOffset < 0 || iconDataOffset + iconDataEntry.dataSize > sectionBuf.length) {
      return undefined;
    }

    const iconData = sectionBuf.subarray(iconDataOffset, iconDataOffset + iconDataEntry.dataSize);
    const png = dibToPng(Buffer.from(iconData), bestEntry.bWidth, bestEntry.bHeight);

    // Determine actual dimensions from the icon data
    let actualWidth = bestEntry.bWidth;
    let actualHeight = bestEntry.bHeight;
    if (iconData.length >= 4 && iconData.readUInt32BE(0) === PNG_SIGNATURE) {
      // For PNG data, read dimensions from IHDR
      if (iconData.length >= 24) {
        actualWidth = iconData.readUInt32BE(16);
        actualHeight = iconData.readUInt32BE(20);
      }
    }

    return { width: actualWidth, height: actualHeight, png };
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Extract the icon from a PE executable and write it to a PNG file.
 */
export function extractIconToFile(exePath: string, outputPath: string, width: number = 32): void {
  const icon = extractIcon(exePath, width);
  if (icon === undefined) {
    throw new Error(`failed to extract icon from ${exePath}`);
  }
  fs.writeFileSync(outputPath, icon.png);
}
