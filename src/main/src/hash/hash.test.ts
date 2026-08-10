import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hashFileStream, isSupportedAlgorithm } from "./compute";

// deterministic pseudo-random bytes so digests are reproducible across runs
function generateBytes(size: number, seed: number): Buffer {
  const buf = Buffer.alloc(size);
  let state = seed;
  for (let i = 0; i < size; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    buf[i] = state & 0xff;
  }
  return buf;
}

function reference(algorithm: string, buf: Buffer): string {
  return crypto.createHash(algorithm).update(buf).digest("hex");
}

const SIZES = [
  { name: "empty", size: 0, seed: 1 },
  { name: "1kb", size: 1024, seed: 42 },
  { name: "100kb", size: 102400, seed: 200 },
  // larger than the default 64kb read highWaterMark, so multiple chunks stream
  { name: "1mb", size: 1048576, seed: 300 },
];

const ALGORITHMS = ["md5", "sha1", "sha256"];

let tmpDir: string;
const filePathFor = (name: string) => path.join(tmpDir, `${name}.bin`);

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hash-test-"));
  for (const tc of SIZES) {
    fs.writeFileSync(filePathFor(tc.name), generateBytes(tc.size, tc.seed));
  }
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("hashFileStream - correctness", () => {
  for (const algorithm of ALGORITHMS) {
    for (const tc of SIZES) {
      it(`${algorithm} matches crypto for ${tc.name}`, async () => {
        const buf = generateBytes(tc.size, tc.seed);
        const { hash, numBytes } = await hashFileStream(algorithm, filePathFor(tc.name));
        expect(hash).toBe(reference(algorithm, buf));
        expect(numBytes).toBe(tc.size);
      });
    }
  }
});

describe("hashFileStream - error handling", () => {
  it("rejects an unsupported algorithm", async () => {
    await expect(hashFileStream("not-a-real-hash", filePathFor("1kb"))).rejects.toThrow(
      /unsupported hash algorithm/,
    );
  });

  it("rejects when the file does not exist", async () => {
    await expect(hashFileStream("md5", path.join(tmpDir, "missing.bin"))).rejects.toThrow();
  });
});

describe("isSupportedAlgorithm", () => {
  it("accepts md5 and rejects nonsense", () => {
    expect(isSupportedAlgorithm("md5")).toBe(true);
    expect(isSupportedAlgorithm("not-a-real-hash")).toBe(false);
  });
});
