import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";
import * as path from "path";
import * as os from "os";
import * as fsExtra from "fs-extra";

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

  describe("file-based hashing", () => {
    let tmpDir: string;
    let tmpFile: string;

    beforeEach(async () => {
      tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "checksum-test-"));
      tmpFile = path.join(tmpDir, "test.bin");
    });

    afterEach(async () => {
      await fsExtra.remove(tmpDir);
    });

    it("produces correct MD5 for a file with known content", async () => {
      const content = "The quick brown fox jumps over the lazy dog";
      const expected = createHash("md5").update(content).digest("hex");
      await fsExtra.writeFile(tmpFile, content);

      const result = await fileMD5(tmpFile);
      expect(result).toBe(expected);
    });

    it("produces correct MD5 for an empty file", async () => {
      await fsExtra.writeFile(tmpFile, "");
      const result = await fileMD5(tmpFile);
      expect(result).toBe("d41d8cd98f00b204e9800998ecf8427e");
    });

    it("produces correct MD5 for binary data", async () => {
      const buf = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) buf[i] = i;
      const expected = createHash("md5").update(buf).digest("hex");
      await fsExtra.writeFile(tmpFile, buf);

      const result = await fileMD5(tmpFile);
      expect(result).toBe(expected);
    });

    it("produces correct MD5 for a large file (1MB)", async () => {
      const buf = Buffer.alloc(1024 * 1024);
      for (let i = 0; i < buf.length; i++) buf[i] = i % 256;
      const expected = createHash("md5").update(buf).digest("hex");
      await fsExtra.writeFile(tmpFile, buf);

      const result = await fileMD5(tmpFile);
      expect(result).toBe(expected);
    });

    it("reports progress for file hashing", async () => {
      const buf = Buffer.alloc(256 * 1024); // 256KB
      await fsExtra.writeFile(tmpFile, buf);
      const progress = vi.fn();

      await fileMD5(tmpFile, progress);

      expect(progress).toHaveBeenCalled();
      // Last call should report total bytes equal to file size
      const lastCall = progress.mock.calls[progress.mock.calls.length - 1];
      expect(lastCall[0]).toBe(buf.length); // bytesProcessed
      expect(lastCall[1]).toBe(buf.length); // totalBytes
    });

    it("rejects for non-existent file", async () => {
      await expect(fileMD5(path.join(tmpDir, "nope.bin"))).rejects.toThrow();
    });
  });
});
