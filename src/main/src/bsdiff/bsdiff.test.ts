import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, it, expect, afterAll } from "vitest";

import { applyPatchFile, createPatchFile } from "./patch";
import { applyPatch, createPatch, loadWasm } from "./wasm";

const TEST_DATA_DIR = path.resolve(__dirname, "..", "..", "test-data");

// hdiff.wasm ships with the @hot-updater/bsdiff package. Load the module once
// and reuse the instance for every case, the same way the worker does at runtime.
function wasmPath(): string {
  const pkgEntry = require.resolve("@hot-updater/bsdiff");
  return path.join(path.resolve(pkgEntry, "..", ".."), "assets", "hdiff.wasm");
}
const wasm = loadWasm(fs.readFileSync(wasmPath()));

// --- Helpers ---

function generateBytes(size: number, seed: number): Buffer {
  const buf = Buffer.alloc(size);
  let state = seed;
  for (let i = 0; i < size; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    buf[i] = state & 0xff;
  }
  return buf;
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

describe("bsdiff wasm core - buffer API", () => {
  for (const tc of TEST_CASES) {
    it(`round-trips ${tc.name}`, () => {
      const { oldBuf, newBuf } = makeTestPair(tc);
      const patch = createPatch(wasm, oldBuf, newBuf);
      expect(patch.length).toBeGreaterThan(0);
      // Verify BSDIFF40 magic
      const magic = Buffer.from(patch.slice(0, 8)).toString("ascii");
      expect(magic).toBe("BSDIFF40");

      const result = applyPatch(wasm, oldBuf, patch);
      expect(md5(result)).toBe(md5(newBuf));
    });
  }

  it("handles identical files", () => {
    const buf = generateBytes(1024, 999);
    const patch = createPatch(wasm, buf, buf);
    const result = applyPatch(wasm, buf, patch);
    expect(md5(result)).toBe(md5(buf));
  });
});

describe("bsdiff wasm core - file API", () => {
  it("createPatchFile + applyPatchFile round-trips", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bsdiff-file-"));
    const tmpPath = (name: string) => path.join(tmpDir, name);
    try {
      const { oldBuf, newBuf } = makeTestPair(TEST_CASES[1]!); // 10kb-5pct
      fs.writeFileSync(tmpPath("old.bin"), oldBuf);
      fs.writeFileSync(tmpPath("new.bin"), newBuf);

      await createPatchFile(wasm, tmpPath("old.bin"), tmpPath("new.bin"), tmpPath("out.diff"));
      expect(fs.existsSync(tmpPath("out.diff"))).toBe(true);

      await applyPatchFile(wasm, tmpPath("old.bin"), tmpPath("out.diff"), tmpPath("patched.bin"));
      const patched = fs.readFileSync(tmpPath("patched.bin"));
      expect(md5(patched)).toBe(md5(newBuf));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// --- Cross-compatibility with native patches ---

describe("bsdiff wasm core - native cross-compatibility", () => {
  function hasNativeBaseline(): boolean {
    return (
      fs.existsSync(path.join(TEST_DATA_DIR, "native-baseline.json")) &&
      TEST_CASES.every((tc) => fs.existsSync(path.join(TEST_DATA_DIR, `${tc.name}-native.diff`)))
    );
  }

  if (!hasNativeBaseline()) {
    it.skip("native baseline not found (run capture-native-baseline.cjs first)", () => {});
    return;
  }

  const baseline = JSON.parse(
    fs.readFileSync(path.join(TEST_DATA_DIR, "native-baseline.json"), "utf8"),
  ) as NativeBaseline;

  for (const tc of TEST_CASES) {
    it(`applies native patch for ${tc.name}`, () => {
      const { oldBuf, newBuf } = makeTestPair(tc);
      const nativePatch = fs.readFileSync(path.join(TEST_DATA_DIR, `${tc.name}-native.diff`));

      const result = applyPatch(wasm, oldBuf, nativePatch);
      expect(md5(result)).toBe(md5(newBuf));
      expect(md5(result)).toBe(baseline[tc.name]!.newMd5);
    });
  }
});

// --- Performance comparison ---

describe("bsdiff wasm core - performance", () => {
  const wasmResults: Record<string, { diffMs: number; patchMs: number; patchSize: number }> = {};

  for (const tc of TEST_CASES) {
    it(`benchmarks ${tc.name}`, () => {
      const { oldBuf, newBuf } = makeTestPair(tc);

      const diffStart = performance.now();
      const patch = createPatch(wasm, oldBuf, newBuf);
      const diffMs = performance.now() - diffStart;

      const patchStart = performance.now();
      applyPatch(wasm, oldBuf, patch);
      const patchMs = performance.now() - patchStart;

      wasmResults[tc.name] = {
        diffMs: Math.round(diffMs * 100) / 100,
        patchMs: Math.round(patchMs * 100) / 100,
        patchSize: patch.length,
      };
    });
  }

  afterAll(() => {
    const baselinePath = path.join(TEST_DATA_DIR, "native-baseline.json");
    const hasBaseline = fs.existsSync(baselinePath);
    const baseline: NativeBaseline | null = hasBaseline
      ? (JSON.parse(fs.readFileSync(baselinePath, "utf8")) as NativeBaseline)
      : null;

    console.log("\n=== bsdiff Performance: Native vs WASM ===");
    console.log(
      "| Test Case    | Native Diff | WASM Diff | Native Patch | WASM Patch | Patch Size |",
    );
    console.log(
      "|--------------|-------------|-----------|--------------|------------|------------|",
    );
    for (const tc of TEST_CASES) {
      const w = wasmResults[tc.name];
      if (!w) continue;
      const n = baseline?.[tc.name];
      const nDiff = n ? `${n.diffMs}ms` : "n/a";
      const nPatch = n ? `${n.patchMs}ms` : "n/a";
      console.log(
        `| ${tc.name.padEnd(12)} | ${nDiff.padStart(11)} | ${`${w.diffMs}ms`.padStart(9)} | ${nPatch.padStart(12)} | ${`${w.patchMs}ms`.padStart(10)} | ${`${w.patchSize}`.padStart(10)} |`,
      );
    }
  });
});

describe("bsdiff wasm core - error handling", () => {
  it("throws (does not silently succeed) when applying a malformed patch", () => {
    // A buffer that is not a valid BSDIFF40 patch: the WASM apply_patch returns
    // a non-OK status, which createPatch/applyPatch surface as a thrown error.
    const garbagePatch = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(() => applyPatch(wasm, new Uint8Array([1, 2, 3]), garbagePatch)).toThrow();
  });
});
