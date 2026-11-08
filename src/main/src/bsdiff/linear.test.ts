import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createLinearPatchFile } from "./linear";
import { applyPatchFile, createPatchFile, MAX_SUFFIX_SORT_SIZE } from "./patch";
import { applyPatch, loadWasm } from "./wasm";

function wasmPath(): string {
  const pkgEntry = require.resolve("@hot-updater/bsdiff");
  return path.join(path.resolve(pkgEntry, "..", ".."), "assets", "hdiff.wasm");
}
const wasm = loadWasm(fs.readFileSync(wasmPath()));

function generateBytes(size: number, seed: number): Buffer {
  const buf = Buffer.alloc(size);
  let state = seed;
  for (let i = 0; i < size; i++) {
    state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff;
    // the high bits: the low byte of this generator repeats every 256 bytes
    buf[i] = state >>> 16;
  }
  return buf;
}

function md5(buf: Buffer | Uint8Array): string {
  return crypto.createHash("md5").update(buf).digest("hex");
}

describe("bsdiff linear patches", () => {
  let tmpDir: string;
  const tmpPath = (name: string) => path.join(tmpDir, name);

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bsdiff-linear-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // creates a linear patch and applies it with the wasm, returning the patch and the result
  async function roundTrip(
    oldBuf: Buffer,
    newBuf: Buffer,
  ): Promise<{ patch: Buffer; result: Uint8Array }> {
    fs.writeFileSync(tmpPath("old.bin"), oldBuf);
    fs.writeFileSync(tmpPath("new.bin"), newBuf);
    await createLinearPatchFile(wasm, tmpPath("old.bin"), tmpPath("new.bin"), tmpPath("out.diff"));
    const patch = fs.readFileSync(tmpPath("out.diff"));
    return { patch, result: applyPatch(wasm, oldBuf, patch) };
  }

  it("round-trips edits spread over several chunks", async () => {
    const oldBuf = generateBytes(1_200_000, 1);
    const newBuf = Buffer.from(oldBuf);
    for (const pos of [0, 4, 449_999, 450_000, 900_123, 1_199_999]) {
      newBuf[pos] = newBuf[pos]! ^ 0x5a;
    }
    expect(md5((await roundTrip(oldBuf, newBuf)).result)).toBe(md5(newBuf));
  });

  it("round-trips a file that grew", async () => {
    const oldBuf = generateBytes(500_000, 2);
    const newBuf = Buffer.concat([oldBuf, generateBytes(700_000, 3)]);
    newBuf[10] = newBuf[10]! ^ 0xff;
    expect(md5((await roundTrip(oldBuf, newBuf)).result)).toBe(md5(newBuf));
  });

  it("round-trips a file that shrank", async () => {
    const oldBuf = generateBytes(1_000_000, 4);
    const newBuf = Buffer.from(oldBuf.subarray(0, 600_000));
    newBuf[599_999] = newBuf[599_999]! ^ 0xff;
    expect(md5((await roundTrip(oldBuf, newBuf)).result)).toBe(md5(newBuf));
  });

  it("round-trips identical and empty files", async () => {
    const buf = generateBytes(100_000, 5);
    expect(md5((await roundTrip(buf, Buffer.from(buf))).result)).toBe(md5(buf));
    expect(md5((await roundTrip(Buffer.alloc(0), buf)).result)).toBe(md5(buf));
    expect((await roundTrip(buf, Buffer.alloc(0))).result.length).toBe(0);
  });

  it("keeps the patch for an in-place edit small", async () => {
    const oldBuf = generateBytes(5_000_000, 6);
    const newBuf = Buffer.from(oldBuf);
    newBuf[4] = 8;
    const { patch, result } = await roundTrip(oldBuf, newBuf);
    expect(patch.subarray(0, 8).toString("ascii")).toBe("BSDIFF40");
    expect(md5(result)).toBe(md5(newBuf));
    expect(patch.length).toBeLessThan(2048);
  });

  it("round-trips a moved region, at the cost of a large patch", async () => {
    // content shifted by an insertion differs at every later offset: no suffix sort, so
    // the patch is about the file's size, which collection export then rejects
    const oldBuf = generateBytes(1_000_000, 8);
    const newBuf = Buffer.concat([Buffer.from([1, 2, 3]), oldBuf]);
    const { patch, result } = await roundTrip(oldBuf, newBuf);
    expect(md5(result)).toBe(md5(newBuf));
    expect(patch.length).toBeGreaterThan(oldBuf.length / 2);
  });

  it("round-trips a patch spanning several output pages", async () => {
    // unrelated content: the diff stream compresses to more than one 16 MiB page
    const oldBuf = generateBytes(40_000_000, 9);
    const newBuf = generateBytes(40_000_000, 10);
    const { patch, result } = await roundTrip(oldBuf, newBuf);
    expect(patch.length).toBeGreaterThan(32 * 1024 * 1024);
    expect(md5(result)).toBe(md5(newBuf));
  }, 120_000);

  it("uses the linear patch only above the size limit", async () => {
    const oldBuf = generateBytes(1_200_000, 11);
    const newBuf = Buffer.from(oldBuf);
    newBuf[600_000] = newBuf[600_000]! ^ 0xff;
    fs.writeFileSync(tmpPath("old.bin"), oldBuf);
    fs.writeFileSync(tmpPath("new.bin"), newBuf);
    await createLinearPatchFile(wasm, tmpPath("old.bin"), tmpPath("new.bin"), tmpPath("linear"));
    const linear = fs.readFileSync(tmpPath("linear"));

    await createPatchFile(
      wasm,
      tmpPath("old.bin"),
      tmpPath("new.bin"),
      tmpPath("above"),
      1_000_000,
    );
    expect(fs.readFileSync(tmpPath("above")).equals(linear)).toBe(true);

    await createPatchFile(wasm, tmpPath("old.bin"), tmpPath("new.bin"), tmpPath("below"));
    expect(fs.readFileSync(tmpPath("below")).equals(linear)).toBe(false);
  });

  it("patches a file too large for the suffix sort", async () => {
    // a file well past the limit, where the wasm bsdiff runs out of memory. It needs
    // varied content: on long runs of one byte the suffix sort grinds instead of failing
    const pieceSize = 16 * 1024 * 1024;
    const size = MAX_SUFFIX_SORT_SIZE * 3.5;
    const oldFd = fs.openSync(tmpPath("old.bin"), "w");
    for (let pos = 0, seed = 7; pos < size; pos += pieceSize, ++seed) {
      fs.writeSync(oldFd, generateBytes(Math.min(pieceSize, size - pos), seed));
    }
    fs.closeSync(oldFd);
    fs.copyFileSync(tmpPath("old.bin"), tmpPath("new.bin"));
    const newFd = fs.openSync(tmpPath("new.bin"), "r+");
    fs.writeSync(newFd, Buffer.from([8]), 0, 1, 4);
    fs.writeSync(newFd, Buffer.from([0x42]), 0, 1, size - 1);
    fs.closeSync(newFd);

    await createPatchFile(wasm, tmpPath("old.bin"), tmpPath("new.bin"), tmpPath("out.diff"));
    expect(fs.statSync(tmpPath("out.diff")).size).toBeLessThan(64 * 1024);

    await applyPatchFile(wasm, tmpPath("old.bin"), tmpPath("out.diff"), tmpPath("patched.bin"));
    const patched = fs.readFileSync(tmpPath("patched.bin"));
    expect(patched.length).toBe(size);
    expect(patched[4]).toBe(8);
    expect(patched[size - 1]).toBe(0x42);
    expect(md5(patched)).toBe(md5(fs.readFileSync(tmpPath("new.bin"))));
  }, 120_000);
});
