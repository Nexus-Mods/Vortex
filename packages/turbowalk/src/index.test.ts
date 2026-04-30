import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import turbowalk, { type IEntry } from "./index";

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "turbowalk-test-"));

  // Create a directory tree:
  //   root/
  //     file1.txt (10 bytes)
  //     file2.dat (20 bytes)
  //     .hidden   (0 bytes)
  //     subdir/
  //       nested.txt (5 bytes)
  //     emptydir/
  //     .hiddendir/
  //       inside.txt (1 byte)
  fs.writeFileSync(path.join(tmpDir, "file1.txt"), "0123456789");
  fs.writeFileSync(path.join(tmpDir, "file2.dat"), "01234567890123456789");
  fs.writeFileSync(path.join(tmpDir, ".hidden"), "");
  fs.mkdirSync(path.join(tmpDir, "subdir"));
  fs.writeFileSync(path.join(tmpDir, "subdir", "nested.txt"), "hello");
  fs.mkdirSync(path.join(tmpDir, "emptydir"));
  fs.mkdirSync(path.join(tmpDir, ".hiddendir"));
  fs.writeFileSync(path.join(tmpDir, ".hiddendir", "inside.txt"), "x");
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function collect(dir: string, options?: Parameters<typeof turbowalk>[2]): Promise<IEntry[]> {
  const all: IEntry[] = [];
  return turbowalk(dir, (entries) => { all.push(...entries); }, options).then(() => all);
}

describe("turbowalk", () => {
  it("walks all files and directories recursively", async () => {
    const entries = await collect(tmpDir, { skipHidden: false });
    const names = entries.map((e) => path.basename(e.filePath)).sort();
    expect(names).toEqual([
      ".hidden", ".hiddendir", "emptydir", "file1.txt", "file2.dat",
      "inside.txt", "nested.txt", "subdir",
    ]);
  });

  it("skips hidden files and directories by default", async () => {
    const entries = await collect(tmpDir);
    const names = entries.map((e) => path.basename(e.filePath)).sort();
    // .hidden, .hiddendir, and inside.txt (inside .hiddendir) should be excluded
    expect(names).toEqual(["emptydir", "file1.txt", "file2.dat", "nested.txt", "subdir"]);
  });

  it("reports correct isDirectory flag", async () => {
    const entries = await collect(tmpDir, { skipHidden: false });
    const dirs = entries.filter((e) => e.isDirectory).map((e) => path.basename(e.filePath)).sort();
    const files = entries.filter((e) => !e.isDirectory).map((e) => path.basename(e.filePath)).sort();
    expect(dirs).toEqual([".hiddendir", "emptydir", "subdir"]);
    expect(files).toEqual([".hidden", "file1.txt", "file2.dat", "inside.txt", "nested.txt"]);
  });

  it("reports correct file sizes", async () => {
    const entries = await collect(tmpDir, { skipHidden: false });
    const file1 = entries.find((e) => path.basename(e.filePath) === "file1.txt");
    const file2 = entries.find((e) => path.basename(e.filePath) === "file2.dat");
    expect(file1?.size).toBe(10);
    expect(file2?.size).toBe(20);
  });

  it("reports mtime as unix seconds", async () => {
    const entries = await collect(tmpDir, { skipHidden: false });
    const file1 = entries.find((e) => path.basename(e.filePath) === "file1.txt");
    expect(file1?.mtime).toBeGreaterThan(0);
    // Should be within a few seconds of now
    const now = Math.floor(Date.now() / 1000);
    expect(file1!.mtime).toBeGreaterThan(now - 60);
    expect(file1!.mtime).toBeLessThanOrEqual(now + 1);
  });

  it("respects recurse: false", async () => {
    const entries = await collect(tmpDir, { recurse: false, skipHidden: false });
    const names = entries.map((e) => path.basename(e.filePath)).sort();
    // Should only include top-level entries, not nested.txt or inside.txt
    expect(names).toEqual([".hidden", ".hiddendir", "emptydir", "file1.txt", "file2.dat", "subdir"]);
  });

  it("handles non-existent directory gracefully", async () => {
    const entries = await collect(path.join(tmpDir, "nonexistent"));
    expect(entries).toEqual([]);
  });

  it("calls progress callback with batched entries", async () => {
    const calls: number[] = [];
    await turbowalk(tmpDir, (entries) => { calls.push(entries.length); }, { skipHidden: false });
    // At least one call should have been made
    expect(calls.length).toBeGreaterThan(0);
    // Total entries across all calls should match
    const total = calls.reduce((a, b) => a + b, 0);
    expect(total).toBe(8); // 5 files + 3 dirs
  });

  it("returns full absolute paths", async () => {
    const entries = await collect(tmpDir, { skipHidden: false });
    for (const entry of entries) {
      expect(path.isAbsolute(entry.filePath)).toBe(true);
      expect(entry.filePath.startsWith(tmpDir)).toBe(true);
    }
  });
});
