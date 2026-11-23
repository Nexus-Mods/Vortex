import { readFileSync } from "node:fs";
import type * as FsPromises from "node:fs/promises";
import { mkdtemp, rm, writeFile, truncate } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { gunzipSync } from "node:zlib";

import { describe, expect, it, vi } from "vitest";

import { parseMinidump, summarizeMinidumpFile } from "./minidump";

// File position at which reads fail, and the error they fail with
const failingRead = vi.hoisted(() => ({
  at: -1,
  error: (): Error => Object.assign(new Error("i/o error"), { code: "EIO" }),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  return {
    ...actual,
    open: async (...args: Parameters<typeof actual.open>) => {
      const handle = await actual.open(...args);
      const read = handle.read.bind(handle) as (
        buffer: Buffer,
        offset: number,
        length: number,
        position: number,
      ) => ReturnType<typeof handle.read>;
      handle.read = ((buffer: Buffer, offset: number, length: number, position: number) =>
        position === failingRead.at
          ? Promise.reject(failingRead.error())
          : read(buffer, offset, length, position)) as typeof handle.read;
      return handle;
    },
  };
});

// Real Crashpad dumps written by Electron 43 (process.crash() in each process
// type) on Windows and Linux, with captured process memory and usernames
// scrubbed for privacy — the metadata streams the parser reads are untouched.
const loadFixture = (name: string): Buffer =>
  gunzipSync(readFileSync(path.join(__dirname, "__fixtures__", name)));

/** Offset of the MinidumpCrashpadInfo record in a dump. */
function crashpadInfoRva(dump: Buffer): number {
  const streamCount = dump.readUInt32LE(8);
  const directory = dump.readUInt32LE(12);
  for (let i = 0; i < streamCount; i++) {
    if (dump.readUInt32LE(directory + i * 12) === 0x43500001) {
      return dump.readUInt32LE(directory + i * 12 + 8);
    }
  }
  throw new Error("fixture has no crashpad stream");
}

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

  it("keeps the exception when a crashpad count is corrupt", async () => {
    // a crashpad module list whose 50k entries all point at the one valid
    // module record: every entry is readable, but walking them all would
    // cost over a million reads
    const original = loadFixture("windows-renderer.dmp.gz");
    const info = crashpadInfoRva(original);
    const entry = original.subarray(original.readUInt32LE(info + 48) + 4).subarray(0, 12);
    const count = 50_000;
    const list = Buffer.alloc(4 + count * 12);
    list.writeUInt32LE(count);
    for (let i = 0; i < count; i++) {
      entry.copy(list, 4 + i * 12);
    }
    const dump = Buffer.concat([original, list]);
    dump.writeUInt32LE(list.length, info + 44);
    dump.writeUInt32LE(original.length, info + 48);
    const result = await parseMinidump(dump);
    expect(result).toMatchObject({
      summary: { exceptionCode: "0xc0000005", module: "electron.exe" },
    });
    // ptype lives in the module annotations, which were refused
    expect(result.summary?.processType).toBeUndefined();

    const objects = loadFixture("windows-renderer.dmp.gz");
    const moduleList = objects.readUInt32LE(crashpadInfoRva(objects) + 48);
    const moduleInfo = objects.readUInt32LE(moduleList + 4 + 8);
    objects.writeUInt32LE(50_000, objects.readUInt32LE(moduleInfo + 24));
    expect((await parseMinidump(objects)).summary).toMatchObject({
      exceptionCode: "0xc0000005",
      module: "electron.exe",
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

  it("reports what it read when the disk fails in the annotations", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vortex-minidump-"));
    const file = path.join(dir, "crash.dmp");
    const dump = loadFixture("windows-renderer.dmp.gz");
    try {
      await writeFile(file, dump);
      failingRead.at = crashpadInfoRva(dump) + 36;
      const result = await summarizeMinidumpFile(file);
      expect(result).toMatchObject({
        summary: { exceptionCode: "0xc0000005", module: "electron.exe", appVersion: "43.0.0" },
      });
      expect(result.summary?.processType).toBeUndefined();
    } finally {
      failingRead.at = -1;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("tells parser bugs apart from disk errors", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vortex-minidump-"));
    const file = path.join(dir, "crash.dmp");
    const { error } = failingRead;
    try {
      await writeFile(file, loadFixture("windows-renderer.dmp.gz"));
      // the stream directory read, before any summary exists
      failingRead.at = 0;
      expect(await summarizeMinidumpFile(file)).toEqual({ unreadableReason: "read-failed" });
      failingRead.error = () => new TypeError("cannot read properties of undefined");
      expect(await summarizeMinidumpFile(file)).toEqual({
        unreadableReason: "parser-error",
        parserError: "cannot read properties of undefined",
      });
    } finally {
      failingRead.at = -1;
      failingRead.error = error;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
