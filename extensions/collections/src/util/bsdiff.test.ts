import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, it, expect, afterAll } from "vitest";

import { createPatch, applyPatch, diffFiles, patchFiles } from "./bsdiff";

const TEST_DATA_DIR = path.resolve(__dirname, "..", "..", "test-data");

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
    newBuf[Math.floor(tc.size / 2)] ^= 0xff;
  } else {
    newBuf = modifyBytes(oldBuf, tc.changePercent, tc.seed + 1);
  }
  return { oldBuf, newBuf };
}

// --- Data correctness tests ---

describe("bsdiff WASM worker - buffer API", () => {
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

describe("bsdiff WASM worker - file API", () => {
  it("diffFiles + patchFiles round-trips", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bsdiff-file-"));
    const tmpPath = (name: string) => path.join(tmpDir, name);
    try {
      const { oldBuf, newBuf } = makeTestPair(TEST_CASES[1]); // 10kb-5pct
      fs.writeFileSync(tmpPath("old.bin"), oldBuf);
      fs.writeFileSync(tmpPath("new.bin"), newBuf);

      await diffFiles(tmpPath("old.bin"), tmpPath("new.bin"), tmpPath("out.diff"));
      expect(fs.existsSync(tmpPath("out.diff"))).toBe(true);

      await patchFiles(tmpPath("old.bin"), tmpPath("patched.bin"), tmpPath("out.diff"));
      const patched = fs.readFileSync(tmpPath("patched.bin"));
      expect(md5(patched)).toBe(md5(newBuf));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// --- Cross-compatibility with native patches ---

describe("bsdiff WASM worker - native cross-compatibility", () => {
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
  );

  for (const tc of TEST_CASES) {
    it(`applies native patch for ${tc.name}`, async () => {
      const { oldBuf, newBuf } = makeTestPair(tc);
      const nativePatch = fs.readFileSync(path.join(TEST_DATA_DIR, `${tc.name}-native.diff`));

      const result = await applyPatch(oldBuf, nativePatch);
      expect(md5(result)).toBe(md5(newBuf));
      expect(md5(result)).toBe(baseline[tc.name].newMd5);
    });
  }
});

// --- Performance comparison ---

describe("bsdiff WASM worker - performance", () => {
  const wasmResults: Record<string, { diffMs: number; patchMs: number; patchSize: number }> = {};

  for (const tc of TEST_CASES) {
    it(`benchmarks ${tc.name}`, async () => {
      const { oldBuf, newBuf } = makeTestPair(tc);

      const diffStart = performance.now();
      const patch = await createPatch(oldBuf, newBuf);
      const diffMs = performance.now() - diffStart;

      const patchStart = performance.now();
      await applyPatch(oldBuf, patch);
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
    const baseline = hasBaseline ? JSON.parse(fs.readFileSync(baselinePath, "utf8")) : null;

    console.log("\n=== bsdiff Performance: Native vs WASM (worker_threads) ===");
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
