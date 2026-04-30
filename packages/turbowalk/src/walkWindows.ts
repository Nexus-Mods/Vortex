/**
 * Fast directory walking on Windows using koffi FFI.
 *
 * Calls FindFirstFileW / FindNextFileW / FindClose directly, which returns
 * file attributes, size, and timestamps in a single syscall per directory
 * entry — no separate lstat() needed.
 */

import * as path from "path";
import type { IEntry, IWalkOptions } from "./index";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const koffi = require("koffi");

// --- Win32 constants ---

const INVALID_HANDLE_VALUE = -1n;
const FILE_ATTRIBUTE_DIRECTORY = 0x10;
const FILE_ATTRIBUTE_HIDDEN = 0x2;
const FILE_ATTRIBUTE_REPARSE_POINT = 0x400;
const MAX_PATH = 260;

// --- Win32 struct and function definitions ---

// FILETIME: two 32-bit values representing 100ns intervals since 1601-01-01
const FILETIME = koffi.struct("FILETIME", {
  dwLowDateTime: "uint32",
  dwHighDateTime: "uint32",
});

// WIN32_FIND_DATAW: the struct returned by FindFirstFileW / FindNextFileW
const WIN32_FIND_DATAW = koffi.struct("WIN32_FIND_DATAW", {
  dwFileAttributes: "uint32",
  ftCreationTime: FILETIME,
  ftLastAccessTime: FILETIME,
  ftLastWriteTime: FILETIME,
  nFileSizeHigh: "uint32",
  nFileSizeLow: "uint32",
  dwReserved0: "uint32",
  dwReserved1: "uint32",
  cFileName: koffi.array("uint16", MAX_PATH),
  cAlternateFileName: koffi.array("uint16", 14),
});

const kernel32 = koffi.load("kernel32.dll");

const FindFirstFileW = kernel32.func(
  "intptr FindFirstFileW(const uint16 *lpFileName, _Out_ WIN32_FIND_DATAW *lpFindFileData)",
);
const FindNextFileW = kernel32.func(
  "bool FindNextFileW(intptr hFindFile, _Out_ WIN32_FIND_DATAW *lpFindFileData)",
);
const FindClose = kernel32.func("bool FindClose(intptr hFindFile)");

// --- Helpers ---

/** Convert a JS string to a null-terminated UTF-16LE buffer for Win32 wide APIs. */
function toWideString(str: string): Buffer {
  const buf = Buffer.alloc((str.length + 1) * 2);
  for (let i = 0; i < str.length; i++) {
    buf.writeUInt16LE(str.charCodeAt(i), i * 2);
  }
  // null terminator is already 0 from Buffer.alloc
  return buf;
}

/** Read a null-terminated UTF-16LE filename from the cFileName array. */
function readFileName(arr: number[]): string {
  const codes: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === 0) break;
    codes.push(arr[i]!);
  }
  return String.fromCharCode(...codes);
}

/** Convert FILETIME to Unix epoch seconds. */
function filetimeToUnix(ft: { dwLowDateTime: number; dwHighDateTime: number }): number {
  // FILETIME is 100ns intervals since 1601-01-01
  // Unix epoch offset: 11644473600 seconds
  const ticks = (BigInt(ft.dwHighDateTime) << 32n) | BigInt(ft.dwLowDateTime >>> 0);
  return Number(ticks / 10000000n) - 11644473600;
}

/** Combine nFileSizeHigh and nFileSizeLow into a single number. */
function combineSize(high: number, low: number): number {
  if (high === 0) return low >>> 0;
  return Number((BigInt(high) << 32n) | BigInt(low >>> 0));
}

// --- Walk implementation ---

export function walkDirWindows(
  dirPath: string,
  progress: (entries: IEntry[]) => void,
  opts: Required<IWalkOptions>,
): void {
  // Append \* for the search pattern
  const searchPath = path.join(dirPath, "*");
  const wideSearch = toWideString(searchPath);

  const findData: Record<string, unknown> = {};
  const handle = FindFirstFileW(wideSearch, findData) as bigint;

  if (handle === INVALID_HANDLE_VALUE) {
    // Directory doesn't exist or is inaccessible
    return;
  }

  try {
    const entries: IEntry[] = [];
    const subDirs: string[] = [];

    do {
      const fd = findData as {
        dwFileAttributes: number;
        ftLastWriteTime: { dwLowDateTime: number; dwHighDateTime: number };
        nFileSizeHigh: number;
        nFileSizeLow: number;
        cFileName: number[];
      };

      const name = readFileName(fd.cFileName);

      // Skip . and ..
      if (name === "." || name === "..") continue;

      const attrs = fd.dwFileAttributes;
      const isHidden = (attrs & FILE_ATTRIBUTE_HIDDEN) !== 0;
      const isDir = (attrs & FILE_ATTRIBUTE_DIRECTORY) !== 0;
      const isReparsePoint = (attrs & FILE_ATTRIBUTE_REPARSE_POINT) !== 0;

      if (opts.skipHidden && isHidden) continue;

      const fullPath = path.join(dirPath, name);

      entries.push({
        filePath: fullPath,
        isDirectory: isDir,
        isReparsePoint,
        size: combineSize(fd.nFileSizeHigh, fd.nFileSizeLow),
        mtime: filetimeToUnix(fd.ftLastWriteTime),
      });

      if (isDir && opts.recurse && !(opts.skipLinks && isReparsePoint)) {
        subDirs.push(fullPath);
      }
    } while (FindNextFileW(handle, findData));

    if (entries.length > 0) {
      progress(entries);
    }

    for (const sub of subDirs) {
      walkDirWindows(sub, progress, opts);
    }
  } finally {
    FindClose(handle);
  }
}
