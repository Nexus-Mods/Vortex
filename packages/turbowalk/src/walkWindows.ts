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
const STATUS_NO_MORE_FILES = 0x80000006 | 0; // signed
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
const INVALID_HANDLE_VALUE = BigInt(-1);

// NtQueryDirectoryFile information class
const FileFullDirectoryInformation = 2;

// FILETIME epoch offset: 100ns ticks between 1601-01-01 and 1970-01-01
const UNIX_EPOCH_TICKS = 0x019DB1DED53E8000n;
const TICKS_PER_SECOND = 10000000n;

// Buffer for NtQueryDirectoryFile — 1KB matches the old C++ addon's buffer size.
// Counterintuitively, smaller buffers are faster because koffi marshals the
// entire buffer across the FFI boundary each call. 1KB minimizes that overhead
// while still fitting multiple entries per call.
const DIR_BUFFER_SIZE = 1024;

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

const NtQueryDirectoryFile = ntdll.func(
  "int32 NtQueryDirectoryFile(intptr FileHandle, intptr Event, void *ApcRoutine, void *ApcContext, _Out_ IO_STATUS_BLOCK *IoStatusBlock, _Out_ uint8 *FileInformation, uint32 Length, int32 FileInformationClass, bool ReturnSingleEntry, void *FileName, bool RestartScan)",
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

/** Open a directory handle for reading. */
function openDirectory(dirPath: string): bigint {
  // Use \\?\ prefix for long path support
  const prefix =
    dirPath.startsWith("\\\\") ? "" : "\\\\?\\";
  const widePath = toWide(prefix + dirPath + (dirPath.endsWith("\\") ? "" : "\\"));
  return CreateFileW(
    widePath,
    GENERIC_READ,
    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
    null,
    OPEN_EXISTING,
    FILE_FLAG_BACKUP_SEMANTICS,
    0n,
  ) as bigint;
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
        const size = sizeHigh === 0 ? sizeLow : Number((BigInt(sizeHigh) << 32n) | BigInt(sizeLow >>> 0));

        // LastWriteTime → Unix seconds
        const wtLow = buf.readUInt32LE(offset + 24);
        const wtHigh = buf.readUInt32LE(offset + 28);
        const ticks = (BigInt(wtHigh) << 32n) | BigInt(wtLow >>> 0);
        const mtime = Number((ticks - UNIX_EPOCH_TICKS) / TICKS_PER_SECOND);

        const fullPath = dirPath + "\\" + name;

        entries.push({
          filePath: fullPath,
          isDirectory: isDir,
          isReparsePoint,
          size,
          mtime,
        });

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

function walkDirInner(
  dirPath: string,
  entries: IEntry[],
  subDirs: string[],
  opts: Required<IWalkOptions>,
): boolean {
  const handle = openDirectory(dirPath);
  if (handle === INVALID_HANDLE_VALUE) return true; // skip inaccessible

  const ioStatus: Record<string, unknown> = {};
  const buf = Buffer.alloc(DIR_BUFFER_SIZE);

  try {
    while (true) {
      const status = NtQueryDirectoryFile(
        handle,
        0n, // Event
        null, // ApcRoutine
        null, // ApcContext
        ioStatus,
        buf,
        DIR_BUFFER_SIZE,
        FileFullDirectoryInformation,
        false, // ReturnSingleEntry
        null, // FileName (null = wildcard)
        false, // RestartScan
      ) as number;

      if (status === STATUS_SUCCESS) {
        parseEntries(buf, dirPath, opts, entries, subDirs);
      } else {
        // STATUS_NO_MORE_FILES or any error — done with this directory
        break;
      }
    }
  } finally {
    CloseHandle(handle);
  }

  return true;
}

export function walkDirWindows(
  dirPath: string,
  progress: (entries: IEntry[]) => void,
  opts: Required<IWalkOptions>,
): void {
  const allEntries: IEntry[] = [];

  function walkRecursive(dir: string): void {
    const entries: IEntry[] = [];
    const subDirs: string[] = [];

    walkDirInner(dir, entries, subDirs, opts);

    // Accumulate entries and flush when threshold is reached (matching native behavior)
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

  // Flush remaining entries
  if (allEntries.length > 0) {
    progress(allEntries);
  }
}
