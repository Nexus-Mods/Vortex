import { readFile, stat } from "node:fs/promises";
import * as path from "node:path";

/**
 * Minimal minidump reader. Extracts the crash facts that fit in an OTel
 * span — exception code, faulting module + offset, process type — without
 * Breakpad/Crashpad tooling. Full stackwalking needs unwind info and
 * symbols; module-level attribution is enough to cluster native crashes
 * (GPU drivers, AV injections, our own native addons).
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

// dumps hold only stack memory by default; anything bigger is not one of ours
const MAX_DUMP_SIZE = 64 * 1024 * 1024;

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

interface ILocation {
  size: number;
  rva: number;
}

export async function summarizeMinidumpFile(
  filePath: string,
): Promise<IMinidumpSummary | undefined> {
  try {
    if ((await stat(filePath)).size > MAX_DUMP_SIZE) {
      return undefined;
    }
    return parseMinidump(await readFile(filePath));
  } catch {
    return undefined;
  }
}

export function parseMinidump(buffer: Buffer): IMinidumpSummary | undefined {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  try {
    if (view.getUint32(0, true) !== MINIDUMP_SIGNATURE) {
      return undefined;
    }

    const streamCount = view.getUint32(8, true);
    const directoryRva = view.getUint32(12, true);

    const streams = new Map<number, ILocation>();
    for (let i = 0; i < streamCount; i++) {
      const entry = directoryRva + i * 12;
      streams.set(view.getUint32(entry, true), {
        size: view.getUint32(entry + 4, true),
        rva: view.getUint32(entry + 8, true),
      });
    }

    const exception = streams.get(STREAM_EXCEPTION);
    if (exception === undefined) {
      return undefined;
    }

    // MINIDUMP_EXCEPTION_STREAM: ThreadId(0), alignment(4), then
    // MINIDUMP_EXCEPTION: ExceptionCode(8), ExceptionFlags(12),
    // ExceptionRecord(16), ExceptionAddress(24)
    const code = view.getUint32(exception.rva + 8, true);
    const address = Number(view.getBigUint64(exception.rva + 24, true));

    const summary: IMinidumpSummary = {
      exceptionCode: hex(code),
      exceptionName: exceptionName(code, view, streams.get(STREAM_SYSTEM_INFO)),
      exceptionAddress: hex(address),
    };

    const modules = readModules(view, streams.get(STREAM_MODULE_LIST));
    const faulting = modules.find((m) => address >= m.base && address < m.base + m.size);
    if (faulting !== undefined) {
      summary.module = faulting.name;
      summary.moduleVersion = faulting.version;
      summary.moduleOffset = hex(address - faulting.base);
      summary.moduleId = faulting.id;
    }

    const annotations = readCrashpadAnnotations(view, streams.get(STREAM_CRASHPAD_INFO));
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

    return summary;
  } catch {
    // truncated or malformed dump
    return undefined;
  }
}

const hex = (value: number): string => `0x${value.toString(16)}`;

/** Pick the name table by dump origin: MINIDUMP_SYSTEM_INFO PlatformId(20)
 *  distinguishes NT status codes from POSIX signal numbers. */
function exceptionName(
  code: number,
  view: DataView,
  systemInfo: ILocation | undefined,
): string | undefined {
  if (systemInfo !== undefined) {
    const platformId = view.getUint32(systemInfo.rva + 20, true);
    if (platformId === MD_OS_LINUX || platformId === MD_OS_ANDROID) {
      return LINUX_SIGNAL_NAMES[code];
    }
  }
  return WINDOWS_EXCEPTION_NAMES[code];
}

interface IModule {
  name: string;
  base: number;
  size: number;
  version?: string;
  id?: string;
}

function readModules(view: DataView, location: ILocation | undefined): IModule[] {
  if (location === undefined) {
    return [];
  }

  // MINIDUMP_MODULE_LIST: NumberOfModules(0), then MINIDUMP_MODULE[n]:
  // BaseOfImage(0), SizeOfImage(8), CheckSum(12), TimeDateStamp(16),
  // ModuleNameRva(20), VersionInfo(24, VS_FIXEDFILEINFO), CvRecord(76, LOCATION)
  const modules: IModule[] = [];
  const count = view.getUint32(location.rva, true);
  for (let i = 0; i < count; i++) {
    const entry = location.rva + 4 + i * MODULE_ENTRY_SIZE;
    const base = Number(view.getBigUint64(entry, true));
    const size = view.getUint32(entry + 8, true);
    const name = readUtf16String(view, view.getUint32(entry + 20, true));

    let version: string | undefined;
    if (view.getUint32(entry + 24, true) === VS_FIXEDFILEINFO_SIGNATURE) {
      const ms = view.getUint32(entry + 32, true);
      const ls = view.getUint32(entry + 36, true);
      version = `${ms >>> 16}.${ms & 0xffff}.${ls >>> 16}.${ls & 0xffff}`;
    }

    const id = readModuleId(view, {
      size: view.getUint32(entry + 76, true),
      rva: view.getUint32(entry + 80, true),
    });

    modules.push({ name: path.win32.basename(name), base, size, version, id });
  }

  return modules;
}

/** The module's debug identity as a symbol server spells it: CodeView
 *  "RSDS" records give PDB GUID + age, Breakpad's "LEpB" gives the ELF
 *  build id (GUID-formatted, age 0). */
function readModuleId(view: DataView, location: ILocation): string | undefined {
  if (location.rva === 0 || location.size < 24) {
    return undefined;
  }
  const signature = String.fromCharCode(
    view.getUint8(location.rva),
    view.getUint8(location.rva + 1),
    view.getUint8(location.rva + 2),
    view.getUint8(location.rva + 3),
  );
  const guid = Buffer.from(view.buffer, view.byteOffset + location.rva + 4, 16);
  if (signature === "RSDS") {
    return (
      formatGuid(guid) +
      view
        .getUint32(location.rva + 20, true)
        .toString(16)
        .toUpperCase()
    );
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
function readCrashpadAnnotations(
  view: DataView,
  location: ILocation | undefined,
): Map<string, string> {
  const annotations = new Map<string, string>();
  if (location === undefined) {
    return annotations;
  }

  try {
    // MinidumpCrashpadInfo: version(0), report_id(4), client_id(20),
    // simple_annotations(36, LOCATION), module_list(44, LOCATION)
    readSimpleAnnotations(
      view,
      {
        size: view.getUint32(location.rva + 36, true),
        rva: view.getUint32(location.rva + 40, true),
      },
      annotations,
    );

    // MinidumpModuleCrashpadInfoList: count(0), then entries[count]:
    // module_list_index(0), location(4, LOCATION)
    const listRva = view.getUint32(location.rva + 48, true);
    if (listRva === 0) {
      return annotations;
    }
    const moduleCount = view.getUint32(listRva, true);
    for (let i = 0; i < moduleCount; i++) {
      const entry = listRva + 4 + i * 12;
      const infoRva = view.getUint32(entry + 8, true);
      // MinidumpModuleCrashpadInfo: version(0), list_annotations(4),
      // simple_annotations(12, LOCATION), annotation_objects(20, LOCATION)
      readSimpleAnnotations(
        view,
        { size: view.getUint32(infoRva + 12, true), rva: view.getUint32(infoRva + 16, true) },
        annotations,
      );
      readAnnotationObjects(
        view,
        { size: view.getUint32(infoRva + 20, true), rva: view.getUint32(infoRva + 24, true) },
        annotations,
      );
    }
  } catch {
    // annotations are best-effort
  }

  return annotations;
}

/** MinidumpSimpleStringDictionary: count(0), then entries[count]:
 *  key_rva(0), value_rva(4) — both MinidumpUTF8String: length(0), utf8 data. */
function readSimpleAnnotations(
  view: DataView,
  location: ILocation,
  into: Map<string, string>,
): void {
  if (location.rva === 0 || location.size === 0) {
    return;
  }
  const count = view.getUint32(location.rva, true);
  for (let i = 0; i < count; i++) {
    const entry = location.rva + 4 + i * 8;
    const key = readUtf8String(view, view.getUint32(entry, true));
    if (!into.has(key)) {
      into.set(key, readUtf8String(view, view.getUint32(entry + 4, true)));
    }
  }
}

const ANNOTATION_TYPE_STRING = 1;

/** MinidumpAnnotationList — the typed annotation objects where Electron's
 *  Crashpad puts ptype and Chromium its crash keys: count(0), then
 *  entries[count] of 12 bytes: name RVA (MinidumpUTF8String), type u16,
 *  reserved u16, value RVA (MinidumpByteArray: length u32 + utf8 data). */
function readAnnotationObjects(
  view: DataView,
  location: ILocation,
  into: Map<string, string>,
): void {
  if (location.rva === 0 || location.size === 0) {
    return;
  }
  const count = view.getUint32(location.rva, true);
  for (let i = 0; i < count; i++) {
    const entry = location.rva + 4 + i * 12;
    if (view.getUint16(entry + 4, true) !== ANNOTATION_TYPE_STRING) {
      continue;
    }
    const key = readUtf8String(view, view.getUint32(entry, true));
    if (!into.has(key)) {
      into.set(key, readUtf8String(view, view.getUint32(entry + 8, true)));
    }
  }
}

function readUtf16String(view: DataView, rva: number): string {
  const length = view.getUint32(rva, true);
  return Buffer.from(view.buffer, view.byteOffset + rva + 4, length).toString("utf16le");
}

function readUtf8String(view: DataView, rva: number): string {
  const length = view.getUint32(rva, true);
  return Buffer.from(view.buffer, view.byteOffset + rva + 4, length).toString("utf8");
}
