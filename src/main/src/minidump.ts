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
  /** Crashpad process-type annotation: browser, renderer, gpu-process, ... */
  processType?: string;
}

const MINIDUMP_SIGNATURE = 0x504d444d; // "MDMP"

const STREAM_MODULE_LIST = 4;
const STREAM_EXCEPTION = 6;
const STREAM_CRASHPAD_INFO = 0x43500001;

const MODULE_ENTRY_SIZE = 108;
const VS_FIXEDFILEINFO_SIGNATURE = 0xfeef04bd;

// dumps hold only stack memory by default; anything bigger is not one of ours
const MAX_DUMP_SIZE = 64 * 1024 * 1024;

const EXCEPTION_NAMES: Record<number, string> = {
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
      exceptionName: EXCEPTION_NAMES[code],
      exceptionAddress: hex(address),
    };

    const faulting = findModule(view, streams.get(STREAM_MODULE_LIST), address);
    if (faulting !== undefined) {
      summary.module = faulting.name;
      summary.moduleVersion = faulting.version;
      summary.moduleOffset = hex(address - faulting.base);
    }

    summary.processType = readCrashpadProcessType(view, streams.get(STREAM_CRASHPAD_INFO));

    return summary;
  } catch {
    // truncated or malformed dump
    return undefined;
  }
}

const hex = (value: number): string => `0x${value.toString(16)}`;

interface IFaultingModule {
  name: string;
  base: number;
  version?: string;
}

function findModule(
  view: DataView,
  location: ILocation | undefined,
  address: number,
): IFaultingModule | undefined {
  if (location === undefined) {
    return undefined;
  }

  // MINIDUMP_MODULE_LIST: NumberOfModules(0), then MINIDUMP_MODULE[n]:
  // BaseOfImage(0), SizeOfImage(8), CheckSum(12), TimeDateStamp(16),
  // ModuleNameRva(20), VersionInfo(24, VS_FIXEDFILEINFO)
  const count = view.getUint32(location.rva, true);
  for (let i = 0; i < count; i++) {
    const entry = location.rva + 4 + i * MODULE_ENTRY_SIZE;
    const base = Number(view.getBigUint64(entry, true));
    const size = view.getUint32(entry + 8, true);
    if (address < base || address >= base + size) {
      continue;
    }

    const name = readUtf16String(view, view.getUint32(entry + 20, true));

    let version: string | undefined;
    if (view.getUint32(entry + 24, true) === VS_FIXEDFILEINFO_SIGNATURE) {
      const ms = view.getUint32(entry + 32, true);
      const ls = view.getUint32(entry + 36, true);
      version = `${ms >>> 16}.${ms & 0xffff}.${ls >>> 16}.${ls & 0xffff}`;
    }

    return { name: path.win32.basename(name), base, version };
  }

  return undefined;
}

function readCrashpadProcessType(
  view: DataView,
  location: ILocation | undefined,
): string | undefined {
  if (location === undefined) {
    return undefined;
  }

  try {
    // MinidumpCrashpadInfo: version(0), report_id(4), client_id(20),
    // simple_annotations(36, LOCATION), module_list(44, LOCATION)
    const processLevel = readAnnotation(view, {
      size: view.getUint32(location.rva + 36, true),
      rva: view.getUint32(location.rva + 40, true),
    });
    if (processLevel !== undefined) {
      return processLevel;
    }

    // MinidumpModuleCrashpadInfoList: count(0), then entries[count]:
    // module_list_index(0), location(4, LOCATION)
    const listRva = view.getUint32(location.rva + 48, true);
    if (listRva === 0) {
      return undefined;
    }
    const moduleCount = view.getUint32(listRva, true);
    for (let i = 0; i < moduleCount; i++) {
      const entry = listRva + 4 + i * 12;
      const infoRva = view.getUint32(entry + 8, true);
      // MinidumpModuleCrashpadInfo: version(0), list_annotations(4),
      // simple_annotations(12, LOCATION), annotation_objects(20, LOCATION)
      const fromSimple = readAnnotation(view, {
        size: view.getUint32(infoRva + 12, true),
        rva: view.getUint32(infoRva + 16, true),
      });
      if (fromSimple !== undefined) {
        return fromSimple;
      }
      const fromObjects = readAnnotationObjects(view, {
        size: view.getUint32(infoRva + 20, true),
        rva: view.getUint32(infoRva + 24, true),
      });
      if (fromObjects !== undefined) {
        return fromObjects;
      }
    }
  } catch {
    // annotations are best-effort
  }

  return undefined;
}

/** Look up the process type in a MinidumpSimpleStringDictionary:
 *  count(0), then entries[count]: key_rva(0), value_rva(4) — both
 *  MinidumpUTF8String: length(0), utf8 data. */
function readAnnotation(view: DataView, location: ILocation): string | undefined {
  if (location.rva === 0 || location.size === 0) {
    return undefined;
  }
  const count = view.getUint32(location.rva, true);
  for (let i = 0; i < count; i++) {
    const entry = location.rva + 4 + i * 8;
    const key = readUtf8String(view, view.getUint32(entry, true));
    if (key === "ptype" || key === "process_type") {
      return readUtf8String(view, view.getUint32(entry + 4, true));
    }
  }
  return undefined;
}

const ANNOTATION_TYPE_STRING = 1;

/** Look up the process type in a MinidumpAnnotationList — the typed
 *  annotation objects where Electron's Crashpad puts ptype: count(0), then
 *  entries[count] of 12 bytes: name RVA (MinidumpUTF8String), type u16,
 *  reserved u16, value RVA (MinidumpByteArray: length u32 + utf8 data). */
function readAnnotationObjects(view: DataView, location: ILocation): string | undefined {
  if (location.rva === 0 || location.size === 0) {
    return undefined;
  }
  const count = view.getUint32(location.rva, true);
  for (let i = 0; i < count; i++) {
    const entry = location.rva + 4 + i * 12;
    if (view.getUint16(entry + 4, true) !== ANNOTATION_TYPE_STRING) {
      continue;
    }
    const key = readUtf8String(view, view.getUint32(entry, true));
    if (key === "ptype" || key === "process_type") {
      return readUtf8String(view, view.getUint32(entry + 8, true));
    }
  }
  return undefined;
}

function readUtf16String(view: DataView, rva: number): string {
  const length = view.getUint32(rva, true);
  return Buffer.from(view.buffer, view.byteOffset + rva + 4, length).toString("utf16le");
}

function readUtf8String(view: DataView, rva: number): string {
  const length = view.getUint32(rva, true);
  return Buffer.from(view.buffer, view.byteOffset + rva + 4, length).toString("utf8");
}
