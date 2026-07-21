import { readFileSync } from "node:fs";
import * as path from "node:path";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { parseMinidump } from "./minidump";

// Real Crashpad dumps written by Electron 43 (process.crash() in each process
// type), with the captured process memory zeroed for privacy — the metadata
// streams the parser reads are untouched.
const loadFixture = (name: string): Buffer =>
  gunzipSync(readFileSync(path.join(__dirname, "__fixtures__", name)));

/** Locate a stream's RVA via the minidump directory. */
const findStream = (dump: Buffer, type: number): number => {
  const count = dump.readUInt32LE(8);
  const directoryRva = dump.readUInt32LE(12);
  for (let i = 0; i < count; i++) {
    const entry = directoryRva + i * 12;
    if (dump.readUInt32LE(entry) === type) {
      return dump.readUInt32LE(entry + 8);
    }
  }
  throw new Error(`stream ${type} not found`);
};

describe("parseMinidump", () => {
  it("parses a main-process crash", () => {
    expect(parseMinidump(loadFixture("electron43-main-crash.dmp.gz"))).toEqual({
      exceptionCode: "0xc0000005",
      exceptionName: "ACCESS_VIOLATION",
      exceptionAddress: "0x7ff68eb5aef0",
      module: "electron.exe",
      moduleVersion: "43.0.0.0",
      moduleOffset: "0x3aeaef0",
      processType: "browser",
    });
  });

  it("parses a renderer crash", () => {
    expect(parseMinidump(loadFixture("electron43-renderer-crash.dmp.gz"))).toEqual({
      exceptionCode: "0xc0000005",
      exceptionName: "ACCESS_VIOLATION",
      exceptionAddress: "0x7ff68eb5aef0",
      module: "electron.exe",
      moduleVersion: "43.0.0.0",
      moduleOffset: "0x3aeaef0",
      processType: "renderer",
    });
  });

  it("names signals instead of NT status codes for Linux dumps", () => {
    // the real Windows dump with PlatformId and exception code patched —
    // replace with a genuine Linux fixture once one is generated on Linux
    const dump = loadFixture("electron43-main-crash.dmp.gz");
    dump.writeUInt32LE(0x8201, findStream(dump, 7) + 20); // MD_OS_LINUX
    dump.writeUInt32LE(11, findStream(dump, 6) + 8); // SIGSEGV
    const result = parseMinidump(dump);
    expect(result?.exceptionCode).toBe("0xb");
    expect(result?.exceptionName).toBe("SIGSEGV");
  });

  it("returns undefined for non-minidump data", () => {
    expect(parseMinidump(Buffer.from("not a minidump, definitely long enough"))).toBeUndefined();
  });

  it("returns undefined for truncated dumps", () => {
    const dump = loadFixture("electron43-main-crash.dmp.gz");
    expect(parseMinidump(dump.subarray(0, 128))).toBeUndefined();
  });
});
