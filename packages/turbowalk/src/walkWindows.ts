/**
 * Fast directory walking on Windows using koffi FFI.
 *
 * Calls NtQueryDirectoryFile (the same NT API the old C++ addon used) which
 * returns multiple directory entries per syscall in a packed buffer. This
 * avoids the per-entry syscall overhead of FindFirstFileW/FindNextFileW.
 */

import * as path from "path";
import type { IEntry, IWalkOptions } from "./index";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const koffi = require("koffi");

// --- NT constants ---

const STATUS_SUCCESS = 0;
const FILE_ATTRIBUTE_DIRECTORY = 0x10;
const FILE_ATTRIBUTE_HIDDEN = 0x2;
const FILE_ATTRIBUTE_REPARSE_POINT = 0x400;

// CreateFileW constants
const GENERIC_READ = 0x80000000;
const FILE_SHARE_READ = 1;
const FILE_SHARE_WRITE = 2;
const FILE_SHARE_DELETE = 4;
const OPEN_EXISTING = 3;
const FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;
const FILE_FLAG_OPEN_REPARSE_POINT = 0x00200000;
const INVALID_HANDLE_VALUE = BigInt(-1);

// GetLastError codes
const ERROR_FILE_NOT_FOUND = 2;
const ERROR_PATH_NOT_FOUND = 3;
const ERROR_ACCESS_DENIED = 5;
const ERROR_SHARING_VIOLATION = 32;
const ERROR_LOCK_VIOLATION = 33;

// NtQueryDirectoryFile information class
const FileFullDirectoryInformation = 2;
const FileAllInformation = 18;

// FILETIME epoch offset: 100ns ticks between 1601-01-01 and 1970-01-01
const UNIX_EPOCH_TICKS = 0x019DB1DED53E8000n;
const TICKS_PER_SECOND = 10000000n;

// Buffer for NtQueryDirectoryFile — 1KB matches the old C++ addon's buffer size.
// Counterintuitively, smaller buffers are faster because koffi marshals the
// entire buffer across the FFI boundary each call. 1KB minimizes that overhead
// while still fitting multiple entries per call.
//
// A zero-copy approach using VirtualAlloc + koffi.view() with a 64KB buffer
// was benchmarked and beats even the old C++ addon. However, Electron forbids
// external ArrayBuffers (koffi.view throws), so we can't use it in production.
// If that restriction is ever lifted, switch to the zero-copy path.
const DIR_BUFFER_SIZE = 1024;

// Max retries for sharing violations when opening directories
const OPEN_RETRIES = 3;
const RETRY_DELAY_MS = 100;

// --- koffi function bindings ---

const kernel32 = koffi.load("kernel32.dll");
const ntdll = koffi.load("ntdll.dll");

// IO_STATUS_BLOCK — used by NtQueryDirectoryFile
const IO_STATUS_BLOCK = koffi.struct("IO_STATUS_BLOCK", {
  Status: "int32",
  Information: "uintptr",
});

const CreateFileW = kernel32.func(
  "intptr CreateFileW(const uint16 *lpFileName, uint32 dwDesiredAccess, uint32 dwShareMode, void *lpSecurityAttributes, uint32 dwCreationDisposition, uint32 dwFlagsAndAttributes, intptr hTemplateFile)",
);
const CloseHandle = kernel32.func("bool CloseHandle(intptr hObject)");
const GetLastError = kernel32.func("uint32 GetLastError()");
const Sleep = kernel32.func("void Sleep(uint32 dwMilliseconds)");

const NtQueryDirectoryFile = ntdll.func(
  "int32 NtQueryDirectoryFile(intptr FileHandle, intptr Event, void *ApcRoutine, void *ApcContext, _Out_ IO_STATUS_BLOCK *IoStatusBlock, _Out_ uint8 *FileInformation, uint32 Length, int32 FileInformationClass, bool ReturnSingleEntry, void *FileName, bool RestartScan)",
);

const NtQueryInformationFile = ntdll.func(
  "int32 NtQueryInformationFile(intptr FileHandle, _Out_ IO_STATUS_BLOCK *IoStatusBlock, _Out_ uint8 *FileInformation, uint32 Length, int32 FileInformationClass)",
);

// --- Helpers ---

/** Convert a JS string to a null-terminated UTF-16LE buffer. */
function toWide(str: string): Buffer {
  const buf = Buffer.alloc((str.length + 1) * 2);
  for (let i = 0; i < str.length; i++) {
    buf.writeUInt16LE(str.charCodeAt(i), i * 2);
  }
  return buf;
}

/** Apply \\?\ prefix for long path support. */
function ensureLongPathPrefix(dirPath: string): string {
  if (dirPath.startsWith("\\\\?\\") || dirPath.startsWith("\\\\")) {
    return dirPath;
  }
  return "\\\\?\\" + dirPath;
}

/**
 * Open a directory handle for reading.
 * Retries on sharing violations (matching C++ behavior).
 * Returns INVALID_HANDLE_VALUE on failure.
 */
function openDirectory(dirPath: string): bigint {
  const suffix = dirPath.endsWith("\\") ? "" : "\\";
  const widePath = toWide(ensureLongPathPrefix(dirPath) + suffix);

  let handle = INVALID_HANDLE_VALUE;
  for (let tries = 0; tries < OPEN_RETRIES; tries++) {
    handle = CreateFileW(
      widePath,
      GENERIC_READ,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
      null,
      OPEN_EXISTING,
      FILE_FLAG_BACKUP_SEMANTICS,
      0n,
    ) as bigint;

    if (handle !== INVALID_HANDLE_VALUE) return handle;

    const err = GetLastError() as number;
    if (err !== ERROR_SHARING_VIOLATION && err !== ERROR_LOCK_VIOLATION) {
      return INVALID_HANDLE_VALUE;
    }
    if (tries < OPEN_RETRIES - 1) {
      Sleep(RETRY_DELAY_MS);
    }
  }
  return handle;
}

/** Check whether the last CreateFileW error is recoverable (skip the dir) or fatal. */
function shouldSkipDirectory(skipInaccessible: boolean): boolean {
  const err = GetLastError() as number;
  if (err === ERROR_FILE_NOT_FOUND || err === ERROR_PATH_NOT_FOUND) return true;
  if (skipInaccessible && err === ERROR_ACCESS_DENIED) return true;
  return false;
}

/**
 * Get file details (linkCount, id) for a single file.
 * Used only when opts.details is true.
 */
function getFileDetails(
  filePath: string,
  ioStatus: Record<string, unknown>,
): { linkCount: number; id: number; idStr: string } | undefined {
  const widePath = toWide(ensureLongPathPrefix(filePath));
  const handle = CreateFileW(
    widePath,
    0x80, // FILE_READ_ATTRIBUTES
    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
    null,
    OPEN_EXISTING,
    FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
    0n,
  ) as bigint;

  if (handle === INVALID_HANDLE_VALUE) return undefined;

  try {
    // FILE_ALL_INFORMATION is large; we need at least up to InternalInformation
    // BasicInformation (40) + StandardInformation (24) + InternalInformation (8) = 72 bytes
    const infoBuf = Buffer.alloc(128);
    const status = NtQueryInformationFile(
      handle,
      ioStatus,
      infoBuf,
      128,
      FileAllInformation,
    ) as number;

    if (status !== STATUS_SUCCESS) return undefined;

    // StandardInformation starts at offset 40: NumberOfLinks at +16 (offset 56)
    const numberOfLinks = infoBuf.readUInt32LE(56);
    // InternalInformation starts at offset 64: IndexNumber (INT64)
    const indexLow = infoBuf.readUInt32LE(64);
    const indexHigh = infoBuf.readUInt32LE(68);
    const indexNumber = (BigInt(indexHigh) << 32n) | BigInt(indexLow >>> 0);

    return {
      linkCount: numberOfLinks,
      id: Number(indexNumber),
      idStr: String(indexNumber),
    };
  } finally {
    CloseHandle(handle);
  }
}

/**
 * Parse FILE_FULL_DIR_INFORMATION entries from the buffer returned by
 * NtQueryDirectoryFile. Each entry is variable-length:
 *
 *   ULONG  NextEntryOffset     (0)
 *   ULONG  FileIndex           (4)
 *   INT64  CreationTime        (8)
 *   INT64  LastAccessTime      (16)
 *   INT64  LastWriteTime       (24)
 *   INT64  ChangeTime          (32)
 *   INT64  EndOfFile           (40)
 *   INT64  AllocationSize      (48)
 *   ULONG  FileAttributes      (56)
 *   ULONG  FileNameLength      (60)
 *   ULONG  EaSize              (64)
 *   WCHAR  FileName[1]         (68)
 */
function parseEntries(
  buf: Buffer,
  dirPath: string,
  opts: Required<IWalkOptions>,
  entries: IEntry[],
  subDirs: string[],
  ioStatus: Record<string, unknown>,
): void {
  let offset = 0;

  while (true) {
    const nextEntryOffset = buf.readUInt32LE(offset);
    const fileAttributes = buf.readUInt32LE(offset + 56);
    const fileNameLength = buf.readUInt32LE(offset + 60);

    // Read the filename (UTF-16LE)
    const nameStart = offset + 68;
    const name = buf.toString("utf16le", nameStart, nameStart + fileNameLength);

    // Skip . and ..
    if (name !== "." && name !== "..") {
      const isHidden = (fileAttributes & FILE_ATTRIBUTE_HIDDEN) !== 0;

      if (!opts.skipHidden || !isHidden) {
        const isDir = (fileAttributes & FILE_ATTRIBUTE_DIRECTORY) !== 0;
        const isReparsePoint = (fileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) !== 0;

        // EndOfFile (actual file size)
        const sizeLow = buf.readUInt32LE(offset + 40);
        const sizeHigh = buf.readUInt32LE(offset + 44);
        const size =
          sizeHigh === 0
            ? sizeLow
            : Number((BigInt(sizeHigh) << 32n) | BigInt(sizeLow >>> 0));

        // LastWriteTime → Unix seconds
        const wtLow = buf.readUInt32LE(offset + 24);
        const wtHigh = buf.readUInt32LE(offset + 28);
        const ticks = (BigInt(wtHigh) << 32n) | BigInt(wtLow >>> 0);
        const mtime = Number((ticks - UNIX_EPOCH_TICKS) / TICKS_PER_SECOND);

        const fullPath = dirPath + "\\" + name;

        const entry: IEntry = {
          filePath: fullPath,
          isDirectory: isDir,
          isReparsePoint,
          size,
          mtime,
        };

        if (opts.details) {
          const details = getFileDetails(fullPath, ioStatus);
          if (details !== undefined) {
            entry.linkCount = details.linkCount;
            entry.id = details.id;
            entry.idStr = details.idStr;
          }
        }

        entries.push(entry);

        if (isDir && opts.recurse && !(opts.skipLinks && isReparsePoint)) {
          subDirs.push(fullPath);
        }
      }
    }

    if (nextEntryOffset === 0) break;
    offset += nextEntryOffset;
  }
}

// --- Walk implementation ---

export function walkDirWindows(
  dirPath: string,
  progress: (entries: IEntry[]) => void,
  opts: Required<IWalkOptions>,
): void {
  const allEntries: IEntry[] = [];
  // Reuse across all directories to avoid per-directory allocation
  const ioStatus: Record<string, unknown> = {};
  const buf = Buffer.alloc(DIR_BUFFER_SIZE);

  function walkRecursive(dir: string): void {
    const handle = openDirectory(dir);
    if (handle === INVALID_HANDLE_VALUE) {
      if (!shouldSkipDirectory(opts.skipInaccessible)) {
        throw new Error(`Failed to open directory: ${dir}`);
      }
      return;
    }

    const entries: IEntry[] = [];
    const subDirs: string[] = [];

    try {
      while (true) {
        const status = NtQueryDirectoryFile(
          handle,
          0n,
          null,
          null,
          ioStatus,
          buf,
          DIR_BUFFER_SIZE,
          FileFullDirectoryInformation,
          false,
          null,
          false,
        ) as number;

        if (status === STATUS_SUCCESS) {
          parseEntries(buf, dir, opts, entries, subDirs, ioStatus);
        } else {
          break;
        }
      }
    } finally {
      CloseHandle(handle);
    }

    for (const entry of entries) {
      allEntries.push(entry);
    }

    if (allEntries.length >= opts.threshold) {
      progress(allEntries.splice(0));
    }

    for (const sub of subDirs) {
      walkRecursive(sub);
    }

    if (opts.terminators) {
      allEntries.push({
        filePath: dir,
        isDirectory: true,
        isReparsePoint: false,
        size: 0,
        mtime: 0,
        isTerminator: true,
      });
    }
  }

  walkRecursive(dirPath);

  if (allEntries.length > 0) {
    progress(allEntries);
  }
}
