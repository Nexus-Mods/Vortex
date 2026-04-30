/**
 * Pure TypeScript PE version resource parser.
 *
 * Reads VS_FIXEDFILEINFO and StringFileInfo from Windows PE executables
 * without native addons. Follows the PE/COFF spec and VS_VERSIONINFO layout.
 *
 * ## PE file layout (what we navigate)
 *
 * A Windows .exe/.dll is a PE (Portable Executable) file with this structure:
 *
 *   DOS Header (offset 0)
 *     - Starts with "MZ" magic
 *     - e_lfanew (offset 0x3C): pointer to the PE header
 *
 *   PE Header (at e_lfanew)
 *     - PE signature "PE\0\0"
 *     - COFF header: number of sections, size of optional header
 *     - Optional header: PE32 (32-bit) or PE32+ (64-bit)
 *       - Data directories array — index 2 is the Resource Directory (RVA + size)
 *
 *   Section Headers (after optional header)
 *     - Each section maps an RVA range to a file offset
 *     - We find which section contains the resource directory RVA
 *
 * ## Resource directory (what we search)
 *
 * The resource directory is a tree with three levels: Type → Name → Language.
 * We look for type RT_VERSION (16), then take the first name and language
 * entry to reach an IMAGE_RESOURCE_DATA_ENTRY that gives us the RVA and
 * size of the actual version data blob.
 *
 * ## VS_VERSIONINFO (what we parse)
 *
 * The version data blob starts with a VS_VERSIONINFO header:
 *   - wLength, wValueLength, wType
 *   - Key: "VS_VERSION_INFO" (UTF-16, null-terminated)
 *   - Padding to DWORD boundary
 *   - VS_FIXEDFILEINFO (52 bytes, starts with signature 0xFEEF04BD):
 *       dwFileVersionMS / dwFileVersionLS → 4-part file version (e.g. 10.0.22621.1)
 *       dwProductVersionMS / dwProductVersionLS → 4-part product version
 *   - Children:
 *     - StringFileInfo → StringTable → String entries (key/value pairs)
 *       We look for keys "FileVersion" and "ProductVersion" which contain
 *       the human-readable localized version strings.
 *     - VarFileInfo (ignored — contains translation code page info)
 */

import * as fs from "fs";

// --- PE constants ---

const PE_SIGNATURE = 0x00004550; // "PE\0\0"
const PE32_MAGIC = 0x10b;
const PE32PLUS_MAGIC = 0x20b;
const RT_VERSION = 16;
const VS_FFI_SIGNATURE = 0xfeef04bd;

// --- Result types ---

export interface VersionInfo {
  fileVersion: [number, number, number, number];
  productVersion: [number, number, number, number];
  /** Localized FileVersion string from StringFileInfo, or formatted fixed version */
  fileVersionString: string;
  /** Localized ProductVersion string from StringFileInfo, or formatted fixed version */
  productVersionString: string;
}

// --- PE parsing ---

function align(offset: number, boundary: number): number {
  return (offset + boundary - 1) & ~(boundary - 1);
}

/** Locate the resource directory in a PE file. Returns [sectionBuf, virtualAddress]. */
function findResourceSection(
  fd: number,
): { buf: Buffer; sectionVA: number; resourceRVA: number } | undefined {
  const dosHeader = Buffer.alloc(64);
  fs.readSync(fd, dosHeader, 0, 64, 0);
  if (dosHeader.readUInt16LE(0) !== 0x5a4d) return undefined; // "MZ"

  const peOffset = dosHeader.readUInt32LE(0x3c);
  const peHeader = Buffer.alloc(264); // enough for PE sig + COFF + largest optional header
  fs.readSync(fd, peHeader, 0, 264, peOffset);

  if (peHeader.readUInt32LE(0) !== PE_SIGNATURE) return undefined;

  // COFF header starts at offset 4
  const numberOfSections = peHeader.readUInt16LE(6);
  const sizeOfOptionalHeader = peHeader.readUInt16LE(20);

  // Optional header starts at offset 24
  const optMagic = peHeader.readUInt16LE(24);
  let dataDirOffset: number;
  if (optMagic === PE32_MAGIC) {
    dataDirOffset = 24 + 96; // offset within peHeader
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

  // Find the section containing the resource RVA
  for (let i = 0; i < numberOfSections; i++) {
    const sectionVA = sections.readUInt32LE(i * 40 + 12);
    const rawSize = sections.readUInt32LE(i * 40 + 16);
    const rawOffset = sections.readUInt32LE(i * 40 + 20);
    const virtualSize = sections.readUInt32LE(i * 40 + 8);
    const endVA = sectionVA + Math.max(rawSize, virtualSize);

    if (resourceRVA >= sectionVA && resourceRVA < endVA) {
      // Read the entire resource section
      const readSize = Math.min(rawSize, 10 * 1024 * 1024); // cap at 10MB
      const buf = Buffer.alloc(readSize);
      fs.readSync(fd, buf, 0, readSize, rawOffset);
      return { buf, sectionVA, resourceRVA };
    }
  }

  return undefined;
}

/** Navigate the resource directory tree to find RT_VERSION data. */
function findVersionResource(
  buf: Buffer,
  baseOffset: number,
): Buffer | undefined {
  // Parse IMAGE_RESOURCE_DIRECTORY at baseOffset
  const numberOfNamedEntries = buf.readUInt16LE(baseOffset + 12);
  const numberOfIdEntries = buf.readUInt16LE(baseOffset + 14);
  const totalEntries = numberOfNamedEntries + numberOfIdEntries;

  for (let i = 0; i < totalEntries; i++) {
    const entryOffset = baseOffset + 16 + i * 8;
    const nameOrId = buf.readUInt32LE(entryOffset);
    const offsetOrData = buf.readUInt32LE(entryOffset + 4);

    if (nameOrId === RT_VERSION) {
      // Found RT_VERSION — descend into subdirectory
      if (offsetOrData & 0x80000000) {
        const subDirOffset = offsetOrData & 0x7fffffff;
        return findFirstDataEntry(buf, subDirOffset);
      }
    }
  }

  return undefined;
}

/** Recursively descend resource tree until we reach a data entry. */
function findFirstDataEntry(
  buf: Buffer,
  dirOffset: number,
): Buffer | undefined {
  const numberOfNamedEntries = buf.readUInt16LE(dirOffset + 12);
  const numberOfIdEntries = buf.readUInt16LE(dirOffset + 14);
  const totalEntries = numberOfNamedEntries + numberOfIdEntries;

  if (totalEntries === 0) return undefined;

  // Take the first entry
  const entryOffset = dirOffset + 16;
  const offsetOrData = buf.readUInt32LE(entryOffset + 4);

  if (offsetOrData & 0x80000000) {
    // Subdirectory — recurse
    return findFirstDataEntry(buf, offsetOrData & 0x7fffffff);
  } else {
    // Data entry: IMAGE_RESOURCE_DATA_ENTRY
    // Offset 0: RVA of data, Offset 4: size of data
    return buf.subarray(offsetOrData, offsetOrData + 16);
  }
}

// --- VS_VERSIONINFO parsing ---

function readWideString(
  buf: Buffer,
  offset: number,
): { str: string; end: number } {
  const codes: number[] = [];
  let pos = offset;
  while (pos + 1 < buf.length) {
    const code = buf.readUInt16LE(pos);
    pos += 2;
    if (code === 0) break;
    codes.push(code);
  }
  return { str: String.fromCharCode(...codes), end: pos };
}

function parseFixedFileInfo(
  buf: Buffer,
  offset: number,
):
  | {
      fileVersion: [number, number, number, number];
      productVersion: [number, number, number, number];
    }
  | undefined {
  if (offset + 52 > buf.length) return undefined;
  const signature = buf.readUInt32LE(offset);
  if (signature !== VS_FFI_SIGNATURE) return undefined;

  const fileVersionMS = buf.readUInt32LE(offset + 8);
  const fileVersionLS = buf.readUInt32LE(offset + 12);
  const productVersionMS = buf.readUInt32LE(offset + 16);
  const productVersionLS = buf.readUInt32LE(offset + 20);

  return {
    fileVersion: [
      (fileVersionMS >>> 16) & 0xffff,
      fileVersionMS & 0xffff,
      (fileVersionLS >>> 16) & 0xffff,
      fileVersionLS & 0xffff,
    ],
    productVersion: [
      (productVersionMS >>> 16) & 0xffff,
      productVersionMS & 0xffff,
      (productVersionLS >>> 16) & 0xffff,
      productVersionLS & 0xffff,
    ],
  };
}

/** Parse StringFileInfo children to find FileVersion and ProductVersion strings. */
function parseStringFileInfo(
  buf: Buffer,
  offset: number,
  endOffset: number,
): { fileVersionString?: string; productVersionString?: string } {
  const result: { fileVersionString?: string; productVersionString?: string } =
    {};

  // Skip past VS_VERSIONINFO header + VS_FIXEDFILEINFO to reach children
  let pos = offset;

  while (pos < endOffset) {
    pos = align(pos, 4);
    if (pos + 6 > endOffset) break;

    const childLength = buf.readUInt16LE(pos);
    if (childLength === 0) break;
    const childEnd = pos + childLength;

    const { str: childKey } = readWideString(buf, pos + 6);

    if (childKey === "StringFileInfo") {
      parseStringTables(
        buf,
        align(pos + 6 + (childKey.length + 1) * 2, 4),
        childEnd,
        result,
      );
    }

    pos = childEnd;
  }

  return result;
}

function parseStringTables(
  buf: Buffer,
  offset: number,
  endOffset: number,
  result: { fileVersionString?: string; productVersionString?: string },
): void {
  let pos = offset;

  while (pos < endOffset) {
    pos = align(pos, 4);
    if (pos + 6 > endOffset) break;

    const tableLength = buf.readUInt16LE(pos);
    if (tableLength === 0) break;
    const tableEnd = pos + tableLength;

    // Skip table header (length, valueLength, type, key)
    const { end: afterKey } = readWideString(buf, pos + 6);
    let strPos = align(afterKey, 4);

    while (strPos < tableEnd) {
      strPos = align(strPos, 4);
      if (strPos + 6 > tableEnd) break;

      const strLength = buf.readUInt16LE(strPos);
      if (strLength === 0) break;
      const strValueLength = buf.readUInt16LE(strPos + 2);

      const { str: key, end: afterStrKey } = readWideString(buf, strPos + 6);
      const valueOffset = align(afterStrKey, 4);

      if (strValueLength > 0 && valueOffset < tableEnd) {
        const { str: value } = readWideString(buf, valueOffset);
        if (key === "FileVersion") result.fileVersionString = value;
        if (key === "ProductVersion") result.productVersionString = value;
      }

      strPos += strLength;
    }

    pos = tableEnd;
  }
}

// --- Public API ---

export function readVersionInfo(filePath: string): VersionInfo | undefined {
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

    // Navigate resource directory to find RT_VERSION
    const dataEntryBuf = findVersionResource(sectionBuf, resourceOffset);
    if (dataEntryBuf === undefined) return undefined;

    // Read the data entry to find the actual VS_VERSIONINFO data
    const dataRVA = dataEntryBuf.readUInt32LE(0);
    const dataSize = dataEntryBuf.readUInt32LE(4);
    const dataOffset = dataRVA - sectionVA;

    if (dataOffset < 0 || dataOffset + dataSize > sectionBuf.length)
      return undefined;

    const versionBuf = sectionBuf.subarray(dataOffset, dataOffset + dataSize);

    // Parse VS_VERSIONINFO header
    const viLength = versionBuf.readUInt16LE(0);
    const viValueLength = versionBuf.readUInt16LE(2);
    // viType at offset 4
    const { str: viKey, end: afterKey } = readWideString(versionBuf, 6);

    if (viKey !== "VS_VERSION_INFO") return undefined;

    // VS_FIXEDFILEINFO follows after alignment
    const fixedOffset = align(afterKey, 4);
    const fixed = parseFixedFileInfo(versionBuf, fixedOffset);
    if (fixed === undefined) return undefined;

    // Parse children (StringFileInfo/VarFileInfo) after VS_FIXEDFILEINFO
    const childrenStart = align(fixedOffset + viValueLength, 4);
    const strings = parseStringFileInfo(
      versionBuf,
      childrenStart,
      Math.min(viLength, versionBuf.length),
    );

    const fmtFile = fixed.fileVersion.join(".");
    const fmtProduct = fixed.productVersion.join(".");

    return {
      fileVersion: fixed.fileVersion,
      productVersion: fixed.productVersion,
      fileVersionString: strings.fileVersionString ?? fmtFile,
      productVersionString: strings.productVersionString ?? fmtProduct,
    };
  } finally {
    fs.closeSync(fd);
  }
}
