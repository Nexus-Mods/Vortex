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
  it("parses a Windows main-process crash", () => {
    expect(parseMinidump(loadFixture("windows-main.dmp.gz"))).toEqual({
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

  it("parses a Windows renderer crash", () => {
    expect(parseMinidump(loadFixture("windows-renderer.dmp.gz"))).toEqual({
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

  it("parses a Linux main-process crash with signal names", () => {
    // null-pointer segfault: the faulting address resolves to no module
    expect(parseMinidump(loadFixture("linux-main.dmp.gz"))).toEqual({
      summary: {
        exceptionCode: "0xb",
        exceptionName: "SIGSEGV",
        exceptionAddress: "0x0",
        processType: "browser",
        appVersion: "1.0.0",
      },
    });
  });

  it("parses a Linux renderer crash", () => {
    expect(parseMinidump(loadFixture("linux-renderer.dmp.gz"))).toEqual({
      summary: {
        exceptionCode: "0xb",
        exceptionName: "SIGSEGV",
        exceptionAddress: "0x0",
        processType: "renderer",
        appVersion: "1.0.0",
      },
    });
  });

  it("rejects non-minidump data", () => {
    expect(parseMinidump(Buffer.from("not a minidump, definitely long enough"))).toEqual({
      unreadableReason: "invalid-signature",
    });
  });

  it("rejects truncated dumps", () => {
    const dump = loadFixture("windows-main.dmp.gz");
    expect(parseMinidump(dump.subarray(0, 128))).toEqual({ unreadableReason: "malformed-dump" });
  });

  it("distinguishes invalid, truncated and exception-free dumps", () => {
    expect(parseMinidump(Buffer.alloc(32))).toEqual({ unreadableReason: "invalid-signature" });
    expect(parseMinidump(Buffer.alloc(2))).toEqual({ unreadableReason: "malformed-dump" });
    const header = Buffer.alloc(32);
    header.writeUInt32LE(0x504d444d);
    expect(parseMinidump(header)).toEqual({ unreadableReason: "missing-exception" });
    expect(parseMinidump(loadFixture("windows-renderer.dmp.gz").subarray(0, 128))).toEqual({
      unreadableReason: "malformed-dump",
    });
  });
});

describe("summarizeMinidumpFile", () => {
  it("reads real dumps and distinguishes size limits from file errors", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vortex-minidump-"));
    const file = path.join(dir, "crash.dmp");
    try {
      expect(await summarizeMinidumpFile(file)).toEqual({ unreadableReason: "read-failed" });
      await writeFile(file, loadFixture("windows-renderer.dmp.gz"));
      expect(await summarizeMinidumpFile(file)).toMatchObject({
        summary: { processType: "renderer", exceptionCode: "0xc0000005" },
      });
      await truncate(file, 64 * 1024 * 1024 + 1);
      expect(await summarizeMinidumpFile(file)).toEqual({ unreadableReason: "file-too-large" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
