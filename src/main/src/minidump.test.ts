import { readFileSync } from "node:fs";
import * as path from "node:path";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { parseMinidump } from "./minidump";

// Real Crashpad dumps written by Electron 43 (process.crash() in each process
// type) on Windows and Linux, with captured process memory and usernames
// scrubbed for privacy — the metadata streams the parser reads are untouched.
const loadFixture = (name: string): Buffer =>
  gunzipSync(readFileSync(path.join(__dirname, "__fixtures__", name)));

describe("parseMinidump", () => {
  it("parses a Windows main-process crash", () => {
    expect(parseMinidump(loadFixture("windows-main.dmp.gz"))).toEqual({
      exceptionCode: "0xc0000005",
      exceptionName: "ACCESS_VIOLATION",
      exceptionAddress: "0x7ff68eb5aef0",
      module: "electron.exe",
      moduleVersion: "43.0.0.0",
      moduleOffset: "0x3aeaef0",
      processType: "browser",
    });
  });

  it("parses a Windows renderer crash", () => {
    expect(parseMinidump(loadFixture("windows-renderer.dmp.gz"))).toEqual({
      exceptionCode: "0xc0000005",
      exceptionName: "ACCESS_VIOLATION",
      exceptionAddress: "0x7ff68eb5aef0",
      module: "electron.exe",
      moduleVersion: "43.0.0.0",
      moduleOffset: "0x3aeaef0",
      processType: "renderer",
    });
  });

  it("parses a Linux main-process crash with signal names", () => {
    // null-pointer segfault: the faulting address resolves to no module
    expect(parseMinidump(loadFixture("linux-main.dmp.gz"))).toEqual({
      exceptionCode: "0xb",
      exceptionName: "SIGSEGV",
      exceptionAddress: "0x0",
      processType: "browser",
    });
  });

  it("parses a Linux renderer crash", () => {
    expect(parseMinidump(loadFixture("linux-renderer.dmp.gz"))).toEqual({
      exceptionCode: "0xb",
      exceptionName: "SIGSEGV",
      exceptionAddress: "0x0",
      processType: "renderer",
    });
  });

  it("returns undefined for non-minidump data", () => {
    expect(parseMinidump(Buffer.from("not a minidump, definitely long enough"))).toBeUndefined();
  });

  it("returns undefined for truncated dumps", () => {
    const dump = loadFixture("windows-main.dmp.gz");
    expect(parseMinidump(dump.subarray(0, 128))).toBeUndefined();
  });
});
