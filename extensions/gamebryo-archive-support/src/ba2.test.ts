import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, it, expect, beforeAll, afterEach } from "vitest";

import { loadBA2 } from "./ba2";

const TEST_DATA = path.resolve(__dirname, "..", "test-data");
const EXPECTED = JSON.parse(fs.readFileSync(path.join(TEST_DATA, "expected.json"), "utf8"));

describe("BA2 parser", () => {
  describe("GNRL archive", () => {
    it("parses header and file list from stripped archive", async () => {
      const archive = await loadBA2(path.join(TEST_DATA, "test-gnrl.ba2"));
      expect(archive.type).toBe(EXPECTED.gnrl.type);
      expect(archive.version).toBe(EXPECTED.gnrl.version);
      expect(archive.fileList).toEqual(EXPECTED.gnrl.fileList);
      expect(archive.fileList.length).toBe(EXPECTED.gnrl.fileCount);
    });

    it("parses header and file list from full archive", async () => {
      const fullPath = path.join(TEST_DATA, "test-gnrl-full.ba2");
      if (!fs.existsSync(fullPath)) return; // skip if full archive not present
      const archive = await loadBA2(fullPath);
      expect(archive.type).toBe("general");
      expect(archive.fileList).toEqual(EXPECTED.gnrl.fileList);
    });

    it("extracts files from full archive", async () => {
      const fullPath = path.join(TEST_DATA, "test-gnrl-full.ba2");
      if (!fs.existsSync(fullPath)) return;

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ba2-test-"));
      try {
        const archive = await loadBA2(fullPath);
        await archive.extractAll(tmpDir);

        // Verify extracted files exist and have content
        for (const name of EXPECTED.gnrl.fileList) {
          const extracted = path.join(tmpDir, name);
          expect(fs.existsSync(extracted)).toBe(true);
          const stat = fs.statSync(extracted);
          expect(stat.size).toBeGreaterThan(0);
        }
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("DX10 archive", () => {
    it("parses header and file list from stripped archive", async () => {
      const archive = await loadBA2(path.join(TEST_DATA, "test-dx10.ba2"));
      expect(archive.type).toBe(EXPECTED.dx10.type);
      expect(archive.version).toBe(EXPECTED.dx10.version);
      expect(archive.fileList).toEqual(EXPECTED.dx10.fileList);
      expect(archive.fileList.length).toBe(EXPECTED.dx10.fileCount);
    });

    it("parses header and file list from full archive", async () => {
      const fullPath = path.join(TEST_DATA, "test-dx10-full.ba2");
      if (!fs.existsSync(fullPath)) return;
      const archive = await loadBA2(fullPath);
      expect(archive.type).toBe("dx10");
      expect(archive.fileList).toEqual(EXPECTED.dx10.fileList);
    });

    it("extracts DDS files from full archive", async () => {
      const fullPath = path.join(TEST_DATA, "test-dx10-full.ba2");
      if (!fs.existsSync(fullPath)) return;

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ba2-test-"));
      try {
        const archive = await loadBA2(fullPath);
        await archive.extractAll(tmpDir);

        for (const name of EXPECTED.dx10.fileList) {
          const extracted = path.join(tmpDir, name);
          expect(fs.existsSync(extracted)).toBe(true);
          // DDS files should start with "DDS " magic
          const header = Buffer.alloc(4);
          const fd = fs.openSync(extracted, "r");
          fs.readSync(fd, header, 0, 4, 0);
          fs.closeSync(fd);
          expect(header.readUInt32LE(0)).toBe(0x20534444); // "DDS "
        }
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe("error handling", () => {
    it("rejects invalid magic", async () => {
      const tmpFile = path.join(os.tmpdir(), "bad-magic.ba2");
      fs.writeFileSync(tmpFile, Buffer.from("NOT_BA2_FILE_AT_ALL"));
      try {
        await expect(loadBA2(tmpFile)).rejects.toThrow("Invalid BA2 file");
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it("rejects non-existent file", async () => {
      await expect(loadBA2("/no/such/file.ba2")).rejects.toThrow();
    });

    it("rejects truncated header", async () => {
      const tmpFile = path.join(os.tmpdir(), "truncated.ba2");
      // Write only 10 bytes (less than 24-byte header)
      const buf = Buffer.alloc(10);
      buf.write("BTDX", 0, "ascii");
      fs.writeFileSync(tmpFile, buf);
      try {
        await expect(loadBA2(tmpFile)).rejects.toThrow();
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });
});
