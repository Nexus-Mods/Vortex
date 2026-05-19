/**
 * Pure TypeScript PE version resource parser.
 *
 * Reads VS_FIXEDFILEINFO and StringFileInfo from Windows PE executables
 * without native addons. Uses the shared pe-resources package for PE header
 * parsing and resource directory navigation, then handles the VS_VERSIONINFO-
 * specific data format.
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

import { findResourceSection, findResourceType, findFirstDataEntry } from "pe-resources";

// --- Constants ---

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

// --- Helpers ---

function align(offset: number, boundary: number): number {
  return (offset + boundary - 1) & ~(boundary - 1);
}

function readWideString(buf: Buffer, offset: number): { str: string; end: number } {
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

// --- VS_VERSIONINFO parsing ---

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

function parseStringFileInfo(
  buf: Buffer,
  offset: number,
  endOffset: number,
): { fileVersionString?: string; productVersionString?: string } {
  const result: { fileVersionString?: string; productVersionString?: string } = {};

  let pos = offset;

  while (pos < endOffset) {
    pos = align(pos, 4);
    if (pos + 6 > endOffset) break;

    const childLength = buf.readUInt16LE(pos);
    if (childLength === 0) break;
    const childEnd = pos + childLength;

    const { str: childKey } = readWideString(buf, pos + 6);

    if (childKey === "StringFileInfo") {
      parseStringTables(buf, align(pos + 6 + (childKey.length + 1) * 2, 4), childEnd, result);
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
    const typeDirOffset = findResourceType(sectionBuf, resourceOffset, RT_VERSION);
    if (typeDirOffset === undefined) return undefined;

    const dataEntry = findFirstDataEntry(sectionBuf, typeDirOffset);
    if (dataEntry === undefined) return undefined;

    const dataOffset = dataEntry.dataRVA - sectionVA;
    if (dataOffset < 0 || dataOffset + dataEntry.dataSize > sectionBuf.length) return undefined;

    const versionBuf = sectionBuf.subarray(dataOffset, dataOffset + dataEntry.dataSize);

    // Parse VS_VERSIONINFO header
    const viLength = versionBuf.readUInt16LE(0);
    const viValueLength = versionBuf.readUInt16LE(2);
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
