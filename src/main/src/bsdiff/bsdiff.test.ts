import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { hashFileStream } from "../hash/compute";
import { applyPatchFile, createPatchFile } from "./patch";
import { loadWasm } from "./wasm";

const TEST_DATA_DIR = path.resolve(__dirname, "..", "..", "test-data");

// built by scripts/build-hdiffpatch-wasm.mjs. Compile the module once for every
// case, the same way the worker does at runtime.
const wasm = loadWasm(fs.readFileSync(path.join(__dirname, "hdiffpatch", "hdiffz.wasm")));

// --- Helpers ---

// runs fn with the path of a fresh temp folder, removed afterwards
async function withTmpDir<T>(
  fn: (tmpPath: (name: string) => string) => T | Promise<T>,
): Promise<T> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bsdiff-"));
  try {
    return await fn((name) => path.join(tmpDir, name));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// createPatchFile over buffers, through temp files
function createPatch(oldBuf: Uint8Array, newBuf: Uint8Array): Promise<Buffer> {
  return withTmpDir((tmpPath) => {
    fs.writeFileSync(tmpPath("old.bin"), oldBuf);
    fs.writeFileSync(tmpPath("new.bin"), newBuf);
    createPatchFile(wasm, tmpPath("old.bin"), tmpPath("new.bin"), tmpPath("out.diff"));
    return fs.readFileSync(tmpPath("out.diff"));
  });
}

// applyPatchFile over buffers, through temp files
function applyPatch(oldBuf: Uint8Array, patchBuf: Uint8Array): Promise<Buffer> {
  return withTmpDir((tmpPath) => {
    fs.writeFileSync(tmpPath("old.bin"), oldBuf);
    fs.writeFileSync(tmpPath("patch.diff"), patchBuf);
    applyPatchFile(wasm, tmpPath("old.bin"), tmpPath("patch.diff"), tmpPath("new.bin"));
    return fs.readFileSync(tmpPath("new.bin"));
  });
}

function generateBytes(size: number, seed: number): Buffer {
  const buf = Buffer.alloc(size);
  let state = seed;
  for (let i = 0; i < size; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    buf[i] = state & 0xff;
  }
  return buf;
}

// deterministic content that never repeats, like a real archive. CTR is a stream cipher, so
// update returns every byte
function generateNoise(size: number, seed: number): Buffer {
  const cipher = crypto.createCipheriv("aes-128-ctr", Buffer.alloc(16, seed), Buffer.alloc(16));
  return cipher.update(Buffer.alloc(size));
}

function modifyBytes(buf: Buffer, changePercent: number, seed: number): Buffer {
  const result = Buffer.from(buf);
  let state = seed;
  const numChanges = Math.max(1, Math.floor(buf.length * changePercent));
  for (let i = 0; i < numChanges; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const pos = state % buf.length;
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    result[pos] = state & 0xff;
  }
  return result;
}

function md5(buf: Buffer | Uint8Array): string {
  return crypto.createHash("md5").update(buf).digest("hex");
}

// shape of test-data/native-baseline.json, keyed by test-case name
interface INativeBaselineEntry {
  newMd5: string;
  diffMs: number;
  patchMs: number;
}
type NativeBaseline = Record<string, INativeBaselineEntry>;

const TEST_CASES = [
  { name: "1kb-5pct", size: 1024, changePercent: 0.05, seed: 42 },
  { name: "10kb-5pct", size: 10240, changePercent: 0.05, seed: 100 },
  { name: "100kb-5pct", size: 102400, changePercent: 0.05, seed: 200 },
  { name: "1mb-5pct", size: 1048576, changePercent: 0.05, seed: 300 },
  { name: "10kb-1byte", size: 10240, changePercent: 0, seed: 400 },
];

function makeTestPair(tc: (typeof TEST_CASES)[0]): {
  oldBuf: Buffer;
  newBuf: Buffer;
} {
  const oldBuf = generateBytes(tc.size, tc.seed);
  let newBuf: Buffer;
  if (tc.changePercent === 0) {
    newBuf = Buffer.from(oldBuf);
    const flipAt = Math.floor(tc.size / 2);
    newBuf[flipAt] = (newBuf[flipAt] ?? 0) ^ 0xff;
  } else {
    newBuf = modifyBytes(oldBuf, tc.changePercent, tc.seed + 1);
  }
  return { oldBuf, newBuf };
}

// --- Data correctness tests ---

describe("bsdiff wasm core - round trips", () => {
  for (const tc of TEST_CASES) {
    it(`round-trips ${tc.name}`, async () => {
      const { oldBuf, newBuf } = makeTestPair(tc);
      const patch = await createPatch(oldBuf, newBuf);
      expect(patch.length).toBeGreaterThan(0);
      // Verify BSDIFF40 magic
      const magic = Buffer.from(patch.slice(0, 8)).toString("ascii");
      expect(magic).toBe("BSDIFF40");

      const result = await applyPatch(oldBuf, patch);
      expect(md5(result)).toBe(md5(newBuf));
    });
  }

  it("handles identical files", async () => {
    const buf = generateBytes(1024, 999);
    const patch = await createPatch(buf, buf);
    const result = await applyPatch(buf, patch);
    expect(md5(result)).toBe(md5(buf));
  });
});

describe("bsdiff wasm core - file API", () => {
  it("createPatchFile + applyPatchFile round-trips", () =>
    withTmpDir((tmpPath) => {
      const { oldBuf, newBuf } = makeTestPair(TEST_CASES[1]!); // 10kb-5pct
      fs.writeFileSync(tmpPath("old.bin"), oldBuf);
      fs.writeFileSync(tmpPath("new.bin"), newBuf);

      createPatchFile(wasm, tmpPath("old.bin"), tmpPath("new.bin"), tmpPath("out.diff"));
      expect(fs.existsSync(tmpPath("out.diff"))).toBe(true);

      applyPatchFile(wasm, tmpPath("old.bin"), tmpPath("out.diff"), tmpPath("patched.bin"));
      const patched = fs.readFileSync(tmpPath("patched.bin"));
      expect(md5(patched)).toBe(md5(newBuf));
    }));

  // larger than a suffix sort can index in 32-bit wasm, at about 14 bytes per input byte
  it(
    "creates a patch that reproduces an edited 384 MiB file",
    () =>
      withTmpDir(async (tmpPath) => {
        const content = generateNoise(384 * 1024 * 1024, 1);
        fs.writeFileSync(tmpPath("old.bin"), content);
        content[4] = content[4]! ^ 0xff;
        fs.writeFileSync(tmpPath("new.bin"), content);

        createPatchFile(wasm, tmpPath("old.bin"), tmpPath("new.bin"), tmpPath("out.diff"));
        applyPatchFile(wasm, tmpPath("old.bin"), tmpPath("out.diff"), tmpPath("patched.bin"));
        expect((await hashFileStream("md5", tmpPath("patched.bin"))).hash).toBe(md5(content));
      }),
    120_000,
  );

  // the fixture has the shape bsdiff writes for an in-place edit, like patches already in
  // published collections: header, then bzip2 -6 blocks of one control entry (add 2^30,
  // copy 0, seek 0), a diff of zeros with 1 at byte 4, and an empty extra
  it(
    "applies a bsdiff patch to a 1 GiB file",
    () =>
      withTmpDir(async (tmpPath) => {
        const content = generateNoise(1024 * 1024 * 1024, 1);
        fs.writeFileSync(tmpPath("old.bin"), content);
        content[4] = content[4]! + 1;

        applyPatchFile(
          wasm,
          tmpPath("old.bin"),
          path.join(__dirname, "__fixtures__", "increment-byte-4-1gib.diff"),
          tmpPath("patched.bin"),
        );
        expect((await hashFileStream("md5", tmpPath("patched.bin"))).hash).toBe(md5(content));
      }),
    120_000,
  );
});

// --- Cross-compatibility with native patches ---

// run capture-native-baseline.cjs first
function hasNativeBaseline(): boolean {
  return (
    fs.existsSync(path.join(TEST_DATA_DIR, "native-baseline.json")) &&
    TEST_CASES.every((tc) => fs.existsSync(path.join(TEST_DATA_DIR, `${tc.name}-native.diff`)))
  );
}

describe.skipIf(!hasNativeBaseline())("bsdiff wasm core - native cross-compatibility", () => {
  let baseline: NativeBaseline;

  beforeAll(() => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    baseline = JSON.parse(
      fs.readFileSync(path.join(TEST_DATA_DIR, "native-baseline.json"), "utf8"),
    ) as NativeBaseline;
  });

  for (const tc of TEST_CASES) {
    it(`applies native patch for ${tc.name}`, async () => {
      const { oldBuf, newBuf } = makeTestPair(tc);
      const nativePatch = fs.readFileSync(path.join(TEST_DATA_DIR, `${tc.name}-native.diff`));

      const result = await applyPatch(oldBuf, nativePatch);
      expect(md5(result)).toBe(md5(newBuf));
      expect(md5(result)).toBe(baseline[tc.name]!.newMd5);
    });
  }
});

describe("bsdiff wasm core - error handling", () => {
  it("throws (does not silently succeed) when applying a malformed patch", async () => {
    // A buffer that is not a valid BSDIFF40 patch: hdiffz exits with an error,
    // which applyPatchFile surfaces as a thrown error.
    const garbagePatch = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    await expect(applyPatch(new Uint8Array([1, 2, 3]), garbagePatch)).rejects.toThrow(Error);
  });
});
