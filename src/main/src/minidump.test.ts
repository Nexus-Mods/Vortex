import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile, truncate } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { parseMinidump, summarizeMinidumpFile } from "./minidump";

// Real Crashpad dumps written by Electron 43 (process.crash() in each process
// type) on Windows and Linux, with captured process memory and usernames
// scrubbed for privacy — the metadata streams the parser reads are untouched.
const loadFixture = (name: string): Buffer =>
  gunzipSync(readFileSync(path.join(__dirname, "__fixtures__", name)));

describe("parseMinidump", () => {
  it("parses a Windows main-process crash", async () => {
    expect(await parseMinidump(loadFixture("windows-main.dmp.gz"))).toEqual({
      summary: {
        exceptionCode: "0xc0000005",
        exceptionName: "ACCESS_VIOLATION",
        exceptionAddress: "0x7ff68eb5aef0",
        module: "electron.exe",
        moduleVersion: "43.0.0.0",
        moduleOffset: "0x3aeaef0",
        moduleId: "E9212FAA5978A9E44C4C44205044422E1",
        processType: "browser",
        appVersion: "43.0.0",
      },
    });
  });

  it("parses a Windows renderer crash", async () => {
    expect(await parseMinidump(loadFixture("windows-renderer.dmp.gz"))).toEqual({
      summary: {
        exceptionCode: "0xc0000005",
        exceptionName: "ACCESS_VIOLATION",
        exceptionAddress: "0x7ff68eb5aef0",
        module: "electron.exe",
        moduleVersion: "43.0.0.0",
        moduleOffset: "0x3aeaef0",
        moduleId: "E9212FAA5978A9E44C4C44205044422E1",
        processType: "renderer",
        appVersion: "43.0.0",
      },
    });
  });

  it("parses a Linux main-process crash with signal names", async () => {
    // null-pointer segfault: the faulting address resolves to no module
    expect(await parseMinidump(loadFixture("linux-main.dmp.gz"))).toEqual({
      summary: {
        exceptionCode: "0xb",
        exceptionName: "SIGSEGV",
        exceptionAddress: "0x0",
        processType: "browser",
        appVersion: "1.0.0",
      },
    });
  });

  it("parses a Linux renderer crash", async () => {
    expect(await parseMinidump(loadFixture("linux-renderer.dmp.gz"))).toEqual({
      summary: {
        exceptionCode: "0xb",
        exceptionName: "SIGSEGV",
        exceptionAddress: "0x0",
        processType: "renderer",
        appVersion: "1.0.0",
      },
    });
  });

  it("rejects non-minidump data", async () => {
    expect(await parseMinidump(Buffer.from("not a minidump, definitely long enough"))).toEqual({
      unreadableReason: "invalid-signature",
    });
  });

  it("rejects truncated dumps", async () => {
    const dump = loadFixture("windows-main.dmp.gz");
    expect(await parseMinidump(dump.subarray(0, 128))).toEqual({
      unreadableReason: "malformed-dump",
    });
  });

  it("distinguishes invalid, truncated and exception-free dumps", async () => {
    expect(await parseMinidump(Buffer.alloc(32))).toEqual({
      unreadableReason: "invalid-signature",
    });
    expect(await parseMinidump(Buffer.alloc(2))).toEqual({ unreadableReason: "malformed-dump" });
    const header = Buffer.alloc(32);
    header.writeUInt32LE(0x504d444d);
    expect(await parseMinidump(header)).toEqual({ unreadableReason: "missing-exception" });
    expect(await parseMinidump(loadFixture("windows-renderer.dmp.gz").subarray(0, 128))).toEqual({
      unreadableReason: "malformed-dump",
    });
  });
});

describe("summarizeMinidumpFile", () => {
  it("reads real dumps of any size and reports file errors", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vortex-minidump-"));
    const file = path.join(dir, "crash.dmp");
    try {
      expect(await summarizeMinidumpFile(file)).toEqual({ unreadableReason: "read-failed" });
      await writeFile(file, loadFixture("windows-renderer.dmp.gz"));
      expect(await summarizeMinidumpFile(file)).toMatchObject({
        summary: { processType: "renderer", exceptionCode: "0xc0000005" },
      });
      // padded far past what would be reasonable to hold in memory
      await truncate(file, 256 * 1024 * 1024);
      expect(await summarizeMinidumpFile(file)).toMatchObject({
        summary: { processType: "renderer", exceptionCode: "0xc0000005", module: "electron.exe" },
      });
      // a count field that would ask for gigabytes is refused, not attempted
      const corrupt = loadFixture("windows-renderer.dmp.gz");
      corrupt.writeUInt32LE(0xffffffff, 8);
      await writeFile(file, corrupt);
      expect(await summarizeMinidumpFile(file)).toEqual({ unreadableReason: "malformed-dump" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
