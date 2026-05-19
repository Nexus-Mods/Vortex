/**
 * Shared PE (Portable Executable) resource section parser.
 *
 * Provides low-level primitives for navigating the resource directory tree
 * inside Windows .exe/.dll files. Used by higher-level packages (exe-version,
 * icon-extract) that each need a specific resource type.
 *
 * ## PE file layout (what we navigate)
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
 * The resource directory is a tree with three levels: Type -> Name -> Language.
 * Callers specify which resource type they want (RT_VERSION=16, RT_ICON=3, etc.)
 * and this module navigates the tree to reach the data entries.
 */

import * as fs from "fs";

// --- PE constants ---

const PE_SIGNATURE = 0x00004550; // "PE\0\0"
const PE32_MAGIC = 0x10b;
const PE32PLUS_MAGIC = 0x20b;

// --- Types ---

export interface ResourceSection {
  /** Buffer containing the entire resource section data */
  buf: Buffer;
  /** Virtual address of the section in the PE image */
  sectionVA: number;
  /** RVA of the resource directory within the PE image */
  resourceRVA: number;
}

export interface ResourceDataEntry {
  /** RVA of the resource data in the PE image */
  dataRVA: number;
  /** Size of the resource data in bytes */
  dataSize: number;
}

// --- PE header parsing ---

/**
 * Locate the resource section in a PE file.
 *
 * Reads the DOS header, PE header, optional header, and section table to find
 * the section containing the resource directory. Returns the section data as a
 * Buffer along with addressing info needed to convert RVAs to buffer offsets.
 *
 * @param fd An open file descriptor (from fs.openSync)
 * @param maxReadSize Cap on how many bytes to read from the section (default 20MB)
 */
export function findResourceSection(
  fd: number,
  maxReadSize: number = 20 * 1024 * 1024,
): ResourceSection | undefined {
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
      const readSize = Math.min(rawSize, maxReadSize);
      const buf = Buffer.alloc(readSize);
      fs.readSync(fd, buf, 0, readSize, rawOffset);
      return { buf, sectionVA, resourceRVA };
    }
  }

  return undefined;
}

// --- Resource directory navigation ---

/**
 * Find a specific resource type in the root resource directory.
 *
 * Scans the top-level resource directory entries for one matching the given
 * type ID (e.g. RT_VERSION=16, RT_ICON=3, RT_GROUP_ICON=14). Returns the
 * offset of that type's subdirectory within the section buffer.
 */
export function findResourceType(
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

/**
 * Recursively descend a resource subtree until we reach the first data entry.
 *
 * At each directory level, takes the first entry and recurses if it points to
 * another subdirectory. Returns the raw IMAGE_RESOURCE_DATA_ENTRY (16 bytes)
 * when a leaf is reached.
 */
export function findFirstDataEntry(buf: Buffer, dirOffset: number): ResourceDataEntry | undefined {
  const numberOfNamedEntries = buf.readUInt16LE(dirOffset + 12);
  const numberOfIdEntries = buf.readUInt16LE(dirOffset + 14);
  const totalEntries = numberOfNamedEntries + numberOfIdEntries;

  if (totalEntries === 0) return undefined;

  // Take the first entry
  const entryOffset = dirOffset + 16;
  const offsetOrData = buf.readUInt32LE(entryOffset + 4);

  return resolveToDataEntry(buf, offsetOrData);
}

/**
 * Collect all data entries under a resource type subtree, keyed by name/ID.
 *
 * Iterates through all entries at the given directory level and resolves each
 * to its final data entry. Useful when multiple resources of the same type
 * exist (e.g. multiple icon sizes under RT_ICON).
 */
export function collectDataEntries(buf: Buffer, dirOffset: number): Map<number, ResourceDataEntry> {
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

/**
 * Resolve an offset-or-data value to a data entry, recursing through
 * subdirectories as needed.
 */
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
