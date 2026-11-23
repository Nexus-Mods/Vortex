import type { FileHandle } from "node:fs/promises";
import { open } from "node:fs/promises";
import * as path from "node:path";

/**
 * Minimal minidump reader. Extracts the crash facts that fit in an OTel
 * span — exception code, faulting module + offset, process type — without
 * Breakpad/Crashpad tooling. Full stackwalking needs unwind info and
 * symbols; module-level attribution is enough to cluster native crashes
 * (GPU drivers, AV injections, our own native addons).
 *
 * A dump is a directory of offsets into the file, so only the few records
 * the summary needs are read, each by position. Memory use does not depend
 * on the size of the dump.
 *
 * Format reference: MINIDUMP_HEADER and friends (minidumpapiset.h), plus
 * Crashpad's MinidumpCrashpadInfo for the process-type annotation.
 */

export interface IMinidumpSummary {
  /** NT status code as lowercase hex, e.g. "0xc0000005" */
  exceptionCode: string;
  /** Well-known name for the code, e.g. "ACCESS_VIOLATION" */
  exceptionName?: string;
  exceptionAddress: string;
  /** Basename of the module containing the faulting address */
  module?: string;
  moduleVersion?: string;
  /** Faulting address relative to the module base, as hex */
  moduleOffset?: string;
  /** Symbol-server id of the faulting module (PDB GUID + age, or ELF build
   *  id), so the offset can be resolved against a symbol store */
  moduleId?: string;
  /** Crashpad process-type annotation: browser, renderer, gpu-process, ... */
  processType?: string;
  /** Version of the app that wrote the dump: Electron's `_version`
   *  annotation, else the main module's file version */
  appVersion?: string;
  /** Chromium's LOG(FATAL) / CHECK message, when the crash was one */
  fatalMessage?: string;
}

/** Exception code Chromium raises for DumpWithoutCrashing(): a dump was
 *  written but the process carried on, so it is not a crash. */
export const DUMP_WITHOUT_CRASHING_CODE = "0x517a7ed";

const MINIDUMP_SIGNATURE = 0x504d444d; // "MDMP"

const STREAM_MODULE_LIST = 4;
const STREAM_EXCEPTION = 6;
const STREAM_SYSTEM_INFO = 7;
const STREAM_CRASHPAD_INFO = 0x43500001;

const MODULE_ENTRY_SIZE = 108;
const VS_FIXEDFILEINFO_SIGNATURE = 0xfeef04bd;

const WINDOWS_EXCEPTION_NAMES: Record<number, string> = {
  0x0517a7ed: "DUMP_WITHOUT_CRASHING",
  // Crashpad's SIGABRT handler: abort(), e.g. a Node fatal error
  0x40000015: "FATAL_APP_EXIT",
  0x80000003: "BREAKPOINT",
  0xc0000005: "ACCESS_VIOLATION",
  0xc0000006: "IN_PAGE_ERROR",
  0xc000001d: "ILLEGAL_INSTRUCTION",
  0xc0000025: "NONCONTINUABLE_EXCEPTION",
  0xc00000fd: "STACK_OVERFLOW",
  0xc0000135: "DLL_NOT_FOUND",
  0xc0000142: "DLL_INIT_FAILED",
  0xc0000374: "HEAP_CORRUPTION",
  0xc0000409: "STACK_BUFFER_OVERRUN",
  0xc0000602: "FAIL_FAST",
};

// On Linux, Crashpad stores the signal number as the exception code
const LINUX_SIGNAL_NAMES: Record<number, string> = {
  4: "SIGILL",
  5: "SIGTRAP",
  6: "SIGABRT",
  7: "SIGBUS",
  8: "SIGFPE",
  11: "SIGSEGV",
  31: "SIGSYS",
};

// MDOSPlatform values from the SystemInfoStream PlatformId field
const MD_OS_LINUX = 0x8201;
const MD_OS_ANDROID = 0x8202; // why not? xD

// Largest single record read from a dump. Sizes and counts come from the
// file, so a corrupt field must not be able to request an arbitrary amount.
const MAX_READ_SIZE = 1024 * 1024;

interface ILocation {
  size: number;
  rva: number;
}

/** Bytes of a dump, read by position. A read outside the data throws a
 *  RangeError, which the parser reports as a malformed dump. */
interface IByteSource {
  read(offset: number, length: number): Promise<Buffer>;
}

function assertReadable(length: number): void {
  if (!Number.isSafeInteger(length) || length < 0 || length > MAX_READ_SIZE) {
    throw new RangeError(`refusing to read ${length} bytes from a minidump`);
  }
}

function bufferSource(buffer: Buffer): IByteSource {
  return {
    read: (offset, length) =>
      Promise.resolve().then(() => {
        assertReadable(length);
        if (offset + length > buffer.length) {
          throw new RangeError("read past the end of the minidump");
        }
        return buffer.subarray(offset, offset + length);
      }),
  };
}

function fileSource(handle: FileHandle): IByteSource {
  return {
    read: async (offset, length) => {
      assertReadable(length);
      const buffer = Buffer.alloc(length);
      let filled = 0;
      while (filled < length) {
        const { bytesRead } = await handle.read(buffer, filled, length - filled, offset + filled);
        if (bytesRead === 0) {
          throw new RangeError("read past the end of the minidump");
        }
        filled += bytesRead;
      }
      return buffer;
    },
  };
}

export type MinidumpResult =
  | { summary: IMinidumpSummary; unreadableReason?: never }
  | {
      summary?: never;
      unreadableReason:
        | "read-failed"
        | "invalid-signature"
        | "missing-exception"
        | "malformed-dump";
    };

export async function summarizeMinidumpFile(filePath: string): Promise<MinidumpResult> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(filePath, "r");
    return await parse(fileSource(handle));
  } catch {
    return { unreadableReason: "read-failed" };
  } finally {
    await handle?.close().catch(() => {
      /* ignored */
    });
  }
}

export function parseMinidump(buffer: Buffer): Promise<MinidumpResult> {
  return parse(bufferSource(buffer));
}

async function parse(source: IByteSource): Promise<MinidumpResult> {
  try {
    if ((await source.read(0, 4)).readUInt32LE(0) !== MINIDUMP_SIGNATURE) {
      return { unreadableReason: "invalid-signature" };
    }

    // MINIDUMP_HEADER: NumberOfStreams(8), StreamDirectoryRva(12)
    const header = await source.read(8, 8);
    const streamCount = header.readUInt32LE(0);
    const directory = await source.read(header.readUInt32LE(4), streamCount * 12);

    const streams = new Map<number, ILocation>();
    for (let i = 0; i < streamCount; i++) {
      const entry = i * 12;
      streams.set(directory.readUInt32LE(entry), {
        size: directory.readUInt32LE(entry + 4),
        rva: directory.readUInt32LE(entry + 8),
      });
    }

    const exception = streams.get(STREAM_EXCEPTION);
    if (exception === undefined) {
      return { unreadableReason: "missing-exception" };
    }

    // MINIDUMP_EXCEPTION_STREAM: ThreadId(0), alignment(4), then
    // MINIDUMP_EXCEPTION: ExceptionCode(8), ExceptionFlags(12),
    // ExceptionRecord(16), ExceptionAddress(24)
    const record = await source.read(exception.rva + 8, 24);
    const code = record.readUInt32LE(0);
    const address = Number(record.readBigUInt64LE(16));

    const summary: IMinidumpSummary = {
      exceptionCode: hex(code),
      exceptionName: await exceptionName(code, source, streams.get(STREAM_SYSTEM_INFO)),
      exceptionAddress: hex(address),
    };

    const modules = await readModules(source, streams.get(STREAM_MODULE_LIST));
    const faulting = modules.find((m) => address >= m.base && address < m.base + m.size);
    if (faulting !== undefined) {
      summary.module = path.win32.basename(await readUtf16String(source, faulting.nameRva));
      summary.moduleVersion = faulting.version;
      summary.moduleOffset = hex(address - faulting.base);
      summary.moduleId = await readModuleId(source, faulting.debugRecord);
    }

    const annotations = await readCrashpadAnnotations(source, streams.get(STREAM_CRASHPAD_INFO));
    const processType = annotations.get("ptype") ?? annotations.get("process_type");
    if (processType !== undefined) {
      summary.processType = processType;
    }
    // the main executable is always the first module in the list; its file
    // version is the app version with a fourth ".0" appended
    const appVersion =
      annotations.get("_version") ?? modules[0]?.version?.replace(/^(\d+\.\d+\.\d+)\.0$/, "$1");
    if (appVersion !== undefined) {
      summary.appVersion = appVersion;
    }
    const fatalMessage = annotations.get("LOG_FATAL");
    if (fatalMessage !== undefined) {
      summary.fatalMessage = fatalMessage;
    }

    return { summary };
  } catch (err) {
    if (err instanceof RangeError) {
      // truncated or malformed dump
      return { unreadableReason: "malformed-dump" };
    }
    throw err;
  }
}

const hex = (value: number): string => `0x${value.toString(16)}`;

/** Pick the name table by dump origin: MINIDUMP_SYSTEM_INFO PlatformId(20)
 *  distinguishes NT status codes from POSIX signal numbers. */
async function exceptionName(
  code: number,
  source: IByteSource,
  systemInfo: ILocation | undefined,
): Promise<string | undefined> {
  if (systemInfo !== undefined) {
    const platformId = (await source.read(systemInfo.rva + 20, 4)).readUInt32LE(0);
    if (platformId === MD_OS_LINUX || platformId === MD_OS_ANDROID) {
      return LINUX_SIGNAL_NAMES[code];
    }
  }
  return WINDOWS_EXCEPTION_NAMES[code];
}

/** A module as its list entry describes it. The name and debug record live
 *  elsewhere in the file and are only read for the module that is needed. */
interface IModule {
  base: number;
  size: number;
  version?: string;
  nameRva: number;
  debugRecord: ILocation;
}

async function readModules(
  source: IByteSource,
  location: ILocation | undefined,
): Promise<IModule[]> {
  if (location === undefined) {
    return [];
  }

  // MINIDUMP_MODULE_LIST: NumberOfModules(0), then MINIDUMP_MODULE[n]:
  // BaseOfImage(0), SizeOfImage(8), CheckSum(12), TimeDateStamp(16),
  // ModuleNameRva(20), VersionInfo(24, VS_FIXEDFILEINFO), CvRecord(76, LOCATION)
  const count = (await source.read(location.rva, 4)).readUInt32LE(0);
  const list = await source.read(location.rva + 4, count * MODULE_ENTRY_SIZE);

  const modules: IModule[] = [];
  for (let i = 0; i < count; i++) {
    const entry = i * MODULE_ENTRY_SIZE;

    let version: string | undefined;
    if (list.readUInt32LE(entry + 24) === VS_FIXEDFILEINFO_SIGNATURE) {
      const ms = list.readUInt32LE(entry + 32);
      const ls = list.readUInt32LE(entry + 36);
      version = `${ms >>> 16}.${ms & 0xffff}.${ls >>> 16}.${ls & 0xffff}`;
    }

    modules.push({
      base: Number(list.readBigUInt64LE(entry)),
      size: list.readUInt32LE(entry + 8),
      version,
      nameRva: list.readUInt32LE(entry + 20),
      debugRecord: { size: list.readUInt32LE(entry + 76), rva: list.readUInt32LE(entry + 80) },
    });
  }

  return modules;
}

/** The module's debug identity as a symbol server spells it: CodeView
 *  "RSDS" records give PDB GUID + age, Breakpad's "LEpB" gives the ELF
 *  build id (GUID-formatted, age 0). */
async function readModuleId(source: IByteSource, location: ILocation): Promise<string | undefined> {
  if (location.rva === 0 || location.size < 24) {
    return undefined;
  }
  const record = await source.read(location.rva, 24);
  const signature = record.toString("latin1", 0, 4);
  const guid = record.subarray(4, 20);
  if (signature === "RSDS") {
    return formatGuid(guid) + record.readUInt32LE(20).toString(16).toUpperCase();
  }
  if (signature === "LEpB") {
    return formatGuid(guid) + "0";
  }
  return undefined;
}

/** GUID as the symbol server spells it: mixed-endian fields, upper-case, no dashes. */
function formatGuid(bytes: Buffer): string {
  const hex = (b: Buffer): string => b.toString("hex").toUpperCase();
  return (
    hex(Buffer.from(bytes.subarray(0, 4)).reverse()) +
    hex(Buffer.from(bytes.subarray(4, 6)).reverse()) +
    hex(Buffer.from(bytes.subarray(6, 8)).reverse()) +
    hex(bytes.subarray(8, 16))
  );
}

/**
 * Every string annotation in the dump, process-level first, then per module
 * (where Chromium's crash keys such as ptype and LOG_FATAL live). The first
 * value seen for a key wins.
 */
async function readCrashpadAnnotations(
  source: IByteSource,
  location: ILocation | undefined,
): Promise<Map<string, string>> {
  const annotations = new Map<string, string>();
  if (location === undefined) {
    return annotations;
  }

  try {
    // MinidumpCrashpadInfo: version(0), report_id(4), client_id(20),
    // simple_annotations(36, LOCATION), module_list(44, LOCATION)
    const info = await source.read(location.rva + 36, 16);
    await readSimpleAnnotations(
      source,
      { size: info.readUInt32LE(0), rva: info.readUInt32LE(4) },
      annotations,
    );

    // MinidumpModuleCrashpadInfoList: count(0), then entries[count]:
    // module_list_index(0), location(4, LOCATION)
    const listRva = info.readUInt32LE(12);
    if (listRva === 0) {
      return annotations;
    }
    const moduleCount = (await source.read(listRva, 4)).readUInt32LE(0);
    const list = await source.read(listRva + 4, moduleCount * 12);
    for (let i = 0; i < moduleCount; i++) {
      const infoRva = list.readUInt32LE(i * 12 + 8);
      // MinidumpModuleCrashpadInfo: version(0), list_annotations(4),
      // simple_annotations(12, LOCATION), annotation_objects(20, LOCATION)
      const moduleInfo = await source.read(infoRva + 12, 16);
      await readSimpleAnnotations(
        source,
        { size: moduleInfo.readUInt32LE(0), rva: moduleInfo.readUInt32LE(4) },
        annotations,
      );
      await readAnnotationObjects(
        source,
        { size: moduleInfo.readUInt32LE(8), rva: moduleInfo.readUInt32LE(12) },
        annotations,
      );
    }
  } catch (err) {
    // annotations are best-effort, a failing disk is not
    if (!(err instanceof RangeError)) {
      throw err;
    }
  }

  return annotations;
}

/** MinidumpSimpleStringDictionary: count(0), then entries[count]:
 *  key_rva(0), value_rva(4) — both MinidumpUTF8String: length(0), utf8 data. */
async function readSimpleAnnotations(
  source: IByteSource,
  location: ILocation,
  into: Map<string, string>,
): Promise<void> {
  if (location.rva === 0 || location.size === 0) {
    return;
  }
  const count = (await source.read(location.rva, 4)).readUInt32LE(0);
  const entries = await source.read(location.rva + 4, count * 8);
  for (let i = 0; i < count; i++) {
    const key = await readUtf8String(source, entries.readUInt32LE(i * 8));
    if (!into.has(key)) {
      into.set(key, await readUtf8String(source, entries.readUInt32LE(i * 8 + 4)));
    }
  }
}

const ANNOTATION_TYPE_STRING = 1;

/** MinidumpAnnotationList — the typed annotation objects where Electron's
 *  Crashpad puts ptype and Chromium its crash keys: count(0), then
 *  entries[count] of 12 bytes: name RVA (MinidumpUTF8String), type u16,
 *  reserved u16, value RVA (MinidumpByteArray: length u32 + utf8 data). */
async function readAnnotationObjects(
  source: IByteSource,
  location: ILocation,
  into: Map<string, string>,
): Promise<void> {
  if (location.rva === 0 || location.size === 0) {
    return;
  }
  const count = (await source.read(location.rva, 4)).readUInt32LE(0);
  const entries = await source.read(location.rva + 4, count * 12);
  for (let i = 0; i < count; i++) {
    const entry = i * 12;
    if (entries.readUInt16LE(entry + 4) !== ANNOTATION_TYPE_STRING) {
      continue;
    }
    const key = await readUtf8String(source, entries.readUInt32LE(entry));
    if (!into.has(key)) {
      into.set(key, await readUtf8String(source, entries.readUInt32LE(entry + 8)));
    }
  }
}

/** A length-prefixed string: byte length(0), then the data. */
async function readSizedString(
  source: IByteSource,
  rva: number,
  encoding: BufferEncoding,
): Promise<string> {
  const length = (await source.read(rva, 4)).readUInt32LE(0);
  return (await source.read(rva + 4, length)).toString(encoding);
}

const readUtf16String = (source: IByteSource, rva: number): Promise<string> =>
  readSizedString(source, rva, "utf16le");

const readUtf8String = (source: IByteSource, rva: number): Promise<string> =>
  readSizedString(source, rva, "utf8");
