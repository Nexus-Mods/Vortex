import { describe, expect, it } from "vitest";

import { parseMinidump } from "./minidump";

const SIGNATURE = 0x504d444d;
const DIRECTORY_RVA = 32;
const DATA_START = 128;

interface IModuleSpec {
  name: string;
  base: number;
  size: number;
  version?: string;
}

/** Builds a synthetic minidump: header at 0, directory at 32, data from 128. */
class DumpBuilder {
  private buf = Buffer.alloc(65536);
  private cursor = DATA_START;
  private streams: Array<{ type: number; size: number; rva: number }> = [];

  public exceptionStream(code: number, address: number): this {
    const rva = this.alloc(168);
    this.u32(rva + 8, code);
    this.u64(rva + 24, address);
    this.streams.push({ type: 6, size: 168, rva });
    return this;
  }

  public moduleList(modules: IModuleSpec[]): this {
    const nameRvas = modules.map((mod) => this.utf16(mod.name));
    const rva = this.alloc(4 + modules.length * 108);
    this.u32(rva, modules.length);
    modules.forEach((mod, i) => {
      const entry = rva + 4 + i * 108;
      this.u64(entry, mod.base);
      this.u32(entry + 8, mod.size);
      this.u32(entry + 20, nameRvas[i] ?? 0);
      if (mod.version !== undefined) {
        const [a = 0, b = 0, c = 0, d = 0] = mod.version.split(".").map(Number);
        this.u32(entry + 24, 0xfeef04bd);
        this.u32(entry + 32, (a << 16) | b);
        this.u32(entry + 36, (c << 16) | d);
      }
    });
    this.streams.push({ type: 4, size: 4 + modules.length * 108, rva });
    return this;
  }

  public crashpadInfo(
    annotations: Record<string, string>,
    mode: "process" | "module-simple" | "module-objects" = "process",
  ): this {
    const rva = this.alloc(52);
    this.u32(rva, 1);
    if (mode === "process") {
      this.u32(rva + 36, 16);
      this.u32(rva + 40, this.dictionary(annotations));
    } else {
      const annRva =
        mode === "module-simple" ? this.dictionary(annotations) : this.annotationList(annotations);
      const infoRva = this.alloc(28);
      this.u32(infoRva, 1);
      this.u32(infoRva + (mode === "module-simple" ? 12 : 20), 16);
      this.u32(infoRva + (mode === "module-simple" ? 16 : 24), annRva);
      const listRva = this.alloc(16);
      this.u32(listRva, 1);
      this.u32(listRva + 8, 28);
      this.u32(listRva + 12, infoRva);
      this.u32(rva + 44, 16);
      this.u32(rva + 48, listRva);
    }
    this.streams.push({ type: 0x43500001, size: 52, rva });
    return this;
  }

  public build(): Buffer {
    this.u32(0, SIGNATURE);
    this.u32(8, this.streams.length);
    this.u32(12, DIRECTORY_RVA);
    this.streams.forEach((stream, i) => {
      const entry = DIRECTORY_RVA + i * 12;
      this.u32(entry, stream.type);
      this.u32(entry + 4, stream.size);
      this.u32(entry + 8, stream.rva);
    });
    return this.buf.subarray(0, this.cursor);
  }

  private alloc(size: number): number {
    const rva = this.cursor;
    this.cursor += size;
    return rva;
  }

  private u32(offset: number, value: number): void {
    this.buf.writeUInt32LE(value >>> 0, offset);
  }

  private u64(offset: number, value: number): void {
    this.buf.writeBigUInt64LE(BigInt(value), offset);
  }

  private utf16(text: string): number {
    const data = Buffer.from(text, "utf16le");
    const rva = this.alloc(4 + data.length + 2);
    this.u32(rva, data.length);
    data.copy(this.buf, rva + 4);
    return rva;
  }

  private utf8(text: string): number {
    const data = Buffer.from(text, "utf8");
    const rva = this.alloc(4 + data.length + 1);
    this.u32(rva, data.length);
    data.copy(this.buf, rva + 4);
    return rva;
  }

  /** MinidumpAnnotationList: count, then 12-byte typed entries (Electron's ptype location). */
  private annotationList(entries: Record<string, string>): number {
    const kvRvas = Object.entries(entries).map(
      ([key, value]) => [this.utf8(key), this.utf8(value)] as const,
    );
    const rva = this.alloc(4 + kvRvas.length * 12);
    this.u32(rva, kvRvas.length);
    kvRvas.forEach(([key, value], i) => {
      const entry = rva + 4 + i * 12;
      this.u32(entry, key);
      this.buf.writeUInt16LE(1, entry + 4);
      this.u32(entry + 8, value);
    });
    return rva;
  }

  private dictionary(entries: Record<string, string>): number {
    const kvRvas = Object.entries(entries).map(
      ([key, value]) => [this.utf8(key), this.utf8(value)] as const,
    );
    const rva = this.alloc(4 + kvRvas.length * 8);
    this.u32(rva, kvRvas.length);
    kvRvas.forEach(([key, value], i) => {
      this.u32(rva + 4 + i * 8, key);
      this.u32(rva + 8 + i * 8, value);
    });
    return rva;
  }
}

const ACCESS_VIOLATION = 0xc0000005;

describe("parseMinidump", () => {
  it("returns undefined for non-minidump data", () => {
    expect(parseMinidump(Buffer.from("not a minidump, definitely long enough"))).toBeUndefined();
  });

  it("returns undefined when there is no exception stream", () => {
    const dump = new DumpBuilder()
      .moduleList([{ name: "C:\\app\\vortex.exe", base: 0x1000, size: 0x1000 }])
      .build();
    expect(parseMinidump(dump)).toBeUndefined();
  });

  it("extracts exception code, name and address", () => {
    const dump = new DumpBuilder().exceptionStream(ACCESS_VIOLATION, 0xdeadbeef).build();
    expect(parseMinidump(dump)).toEqual({
      exceptionCode: "0xc0000005",
      exceptionName: "ACCESS_VIOLATION",
      exceptionAddress: "0xdeadbeef",
      processType: undefined,
    });
  });

  it("resolves the faulting module with offset and version", () => {
    const dump = new DumpBuilder()
      .exceptionStream(ACCESS_VIOLATION, 0x7ff800008a40)
      .moduleList([
        { name: "C:\\app\\vortex.exe", base: 0x140000000, size: 0x100000, version: "2.4.0.0" },
        {
          name: "C:\\Windows\\System32\\nvwgf2umx.dll",
          base: 0x7ff800000000,
          size: 0x2000000,
          version: "31.0.15.5222",
        },
      ])
      .build();
    const result = parseMinidump(dump);
    expect(result?.module).toBe("nvwgf2umx.dll");
    expect(result?.moduleOffset).toBe("0x8a40");
    expect(result?.moduleVersion).toBe("31.0.15.5222");
  });

  it("leaves module undefined when the address is outside all modules", () => {
    const dump = new DumpBuilder()
      .exceptionStream(ACCESS_VIOLATION, 0x9999999)
      .moduleList([{ name: "C:\\app\\vortex.exe", base: 0x140000000, size: 0x100000 }])
      .build();
    const result = parseMinidump(dump);
    expect(result?.exceptionCode).toBe("0xc0000005");
    expect(result?.module).toBeUndefined();
    expect(result?.moduleOffset).toBeUndefined();
  });

  it("reads the process type from process-level crashpad annotations", () => {
    const dump = new DumpBuilder()
      .exceptionStream(ACCESS_VIOLATION, 0x1000)
      .crashpadInfo({ ptype: "gpu-process" })
      .build();
    expect(parseMinidump(dump)?.processType).toBe("gpu-process");
  });

  it("reads the process type from module-level simple annotations", () => {
    const dump = new DumpBuilder()
      .exceptionStream(ACCESS_VIOLATION, 0x1000)
      .crashpadInfo({ process_type: "renderer" }, "module-simple")
      .build();
    expect(parseMinidump(dump)?.processType).toBe("renderer");
  });

  it("reads the process type from typed annotation objects (Electron's location)", () => {
    const dump = new DumpBuilder()
      .exceptionStream(ACCESS_VIOLATION, 0x1000)
      .crashpadInfo({ pid: "115128", ptype: "renderer", platform: "win32" }, "module-objects")
      .build();
    expect(parseMinidump(dump)?.processType).toBe("renderer");
  });

  it("returns undefined for truncated dumps", () => {
    const dump = new DumpBuilder().exceptionStream(ACCESS_VIOLATION, 0x1000).build();
    expect(parseMinidump(dump.subarray(0, 60))).toBeUndefined();
  });
});
