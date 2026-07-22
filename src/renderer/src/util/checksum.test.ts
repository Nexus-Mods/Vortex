import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { checksum, fileMD5 } from "./checksum";

// Well-known MD5 test vectors (RFC 1321)
const MD5_VECTORS: [string, string][] = [
  ["", "d41d8cd98f00b204e9800998ecf8427e"],
  ["a", "0cc175b9c0f1b6a831c399e269772661"],
  ["abc", "900150983cd24fb0d6963f7d28e17f72"],
  ["message digest", "f96b697d7cb7938d525a2f31aaf161d0"],
  ["abcdefghijklmnopqrstuvwxyz", "c3fcd3d76192e4007dfb496cca67e13b"],
];

describe("checksum", () => {
  it("produces correct MD5 for known test vectors", () => {
    for (const [input, expected] of MD5_VECTORS) {
      const buf = Buffer.from(input, "utf-8");
      expect(checksum(buf)).toBe(expected);
    }
  });
});

describe("fileMD5", () => {
  // Buffers are hashed in the renderer (see checksum.ts), so these need no mock.
  it("produces correct MD5 for Buffer inputs", async () => {
    for (const [input, expected] of MD5_VECTORS) {
      const buf = Buffer.from(input, "utf-8");
      const result = await fileMD5(buf);
      expect(result).toBe(expected);
    }
  });

  it("reports progress for Buffer inputs", async () => {
    const buf = Buffer.from("hello world");
    const progress = vi.fn();
    await fileMD5(buf, progress);
    expect(progress).toHaveBeenCalledWith(buf.length, buf.length);
  });

  // File paths are delegated to the main-process hash worker over the preload
  // API; the digest correctness itself is covered by src/main/src/hash/hash.test.ts.
  // Here we only assert fileMD5 delegates and surfaces the result correctly.
  describe("file-based hashing (delegates to the hash worker)", () => {
    const compute = vi.fn();

    beforeEach(() => {
      vi.stubGlobal("window", { api: { hash: { compute } } });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      compute.mockReset();
    });

    it("passes the algorithm and path to the worker and returns its digest", async () => {
      compute.mockResolvedValue({ hash: "deadbeef", numBytes: 42 });
      const result = await fileMD5("/some/archive.bin");
      expect(compute).toHaveBeenCalledWith("md5", "/some/archive.bin");
      expect(result).toBe("deadbeef");
    });

    it("reports completion progress once with the hashed byte count", async () => {
      compute.mockResolvedValue({ hash: "deadbeef", numBytes: 256 * 1024 });
      const progress = vi.fn();
      await fileMD5("/some/archive.bin", progress);
      expect(progress).toHaveBeenCalledTimes(1);
      expect(progress).toHaveBeenCalledWith(256 * 1024, 256 * 1024);
    });

    it("propagates a worker rejection (e.g. missing file)", async () => {
      compute.mockRejectedValue(new Error("ENOENT: no such file"));
      await expect(fileMD5("/nope.bin")).rejects.toThrow("ENOENT");
    });
  });
});
