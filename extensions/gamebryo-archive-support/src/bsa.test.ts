import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, it, expect } from "vitest";

import { loadBSA, calculateBSAHash } from "./bsa";

const TEST_DATA_DIR = path.resolve(__dirname, "..", "test-data");

interface ExpectedArchive {
  version: number;
  files: Record<string, string>;
}

function loadExpected(): Record<string, ExpectedArchive> {
  return JSON.parse(fs.readFileSync(path.join(TEST_DATA_DIR, "expected-bsa.json"), "utf8"));
}

const SYNTHETIC_BSAS = [
  { key: "v103", file: "test-v103.bsa", label: "v0x67 Oblivion (uncompressed)" },
  { key: "v104", file: "test-v104.bsa", label: "v0x68 Skyrim LE (zlib)" },
  { key: "v105", file: "test-v105.bsa", label: "v0x69 Skyrim SE (LZ4)" },
];

// --- Hash algorithm ---

describe("BSA hash algorithm", () => {
  it("produces consistent hashes for known filenames", () => {
    const hash1 = calculateBSAHash("test.txt");
    expect(hash1).toBeTypeOf("bigint");
    expect(calculateBSAHash("test.txt")).toBe(hash1);
  });

  it("handles case insensitivity", () => {
    expect(calculateBSAHash("Test.TXT")).toBe(calculateBSAHash("test.txt"));
    expect(calculateBSAHash("MESHES\\WEAPON.NIF")).toBe(calculateBSAHash("meshes\\weapon.nif"));
  });

  it("normalizes forward slashes to backslashes", () => {
    expect(calculateBSAHash("meshes/weapon.nif")).toBe(calculateBSAHash("meshes\\weapon.nif"));
  });

  it("applies extension-specific flags", () => {
    const nifHash = calculateBSAHash("test.nif");
    const ddsHash = calculateBSAHash("test.dds");
    const wavHash = calculateBSAHash("test.wav");
    const kfHash = calculateBSAHash("test.kf");
    const txtHash = calculateBSAHash("test.txt");

    expect(nifHash).not.toBe(ddsHash);
    expect(nifHash).not.toBe(wavHash);
    expect(nifHash).not.toBe(txtHash);

    expect(Number(nifHash & 0x8000n)).toBe(0x8000);
    expect(Number(ddsHash & 0x8080n)).toBe(0x8080);
    expect(Number(kfHash & 0x80n)).toBe(0x80);
  });
});

// --- Parser and extraction ---

describe("BSA parser", () => {
  const expected = loadExpected();

  for (const bsa of SYNTHETIC_BSAS) {
    const bsaPath = path.join(TEST_DATA_DIR, bsa.file);
    const exp = expected[bsa.key];

    describe(bsa.label, () => {
      it("loads and parses header", async () => {
        const archive = await loadBSA(bsaPath);
        expect(archive.version).toBe(exp.version);
        expect(archive.fileCount).toBe(Object.keys(exp.files).length);
        expect(archive.fileList.length).toBe(archive.fileCount);
      });

      it("matches expected file list", async () => {
        const archive = await loadBSA(bsaPath);
        const expectedPaths = new Set(Object.keys(exp.files).map((p) => p.toLowerCase()));
        const actualPaths = new Set(archive.fileList.map((f) => f.fullPath.toLowerCase()));
        expect(actualPaths).toEqual(expectedPaths);
      });

      it("passes hash verification", async () => {
        await expect(loadBSA(bsaPath, true)).resolves.toBeTruthy();
      });

      it("extractAll produces correct content", async () => {
        const archive = await loadBSA(bsaPath);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bsa-test-"));

        try {
          await archive.extractAll(tmpDir);
          verifyExtractedContent(tmpDir, exp.files);
        } finally {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      });

      it("extractFile produces correct content", async () => {
        const archive = await loadBSA(bsaPath);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bsa-single-test-"));

        try {
          for (const file of archive.fileList) {
            const outDir = path.join(tmpDir, file.folderPath);
            await archive.extractFile(file, outDir);
          }
          verifyExtractedContent(tmpDir, exp.files);
        } finally {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      });
    });
  }
});

// --- Error handling ---

describe("error handling", () => {
  it("rejects invalid magic", async () => {
    const tmpFile = path.join(os.tmpdir(), "bad-magic.bsa");
    fs.writeFileSync(tmpFile, Buffer.from("NOT_BSA_FILE_AT_ALL"));
    try {
      await expect(loadBSA(tmpFile)).rejects.toThrow("Invalid BSA file");
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it("rejects non-existent file", async () => {
    await expect(loadBSA("/no/such/file.bsa")).rejects.toThrow();
  });
});

// --- Helpers ---

function verifyExtractedContent(tmpDir: string, expectedFiles: Record<string, string>): void {
  const extractedMap = new Map<string, string>();
  function walk(dir: string, prefix: string) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const relPath = prefix ? prefix + "\\" + entry : entry;
      if (fs.statSync(full).isDirectory()) {
        walk(full, relPath);
      } else {
        extractedMap.set(relPath.toLowerCase(), full);
      }
    }
  }
  walk(tmpDir, "");

  let verified = 0;
  for (const [archivePath, expectedContent] of Object.entries(expectedFiles)) {
    const extracted = extractedMap.get(archivePath.toLowerCase());
    expect(extracted).toBeDefined();
    const actual = fs.readFileSync(extracted!, "utf8");
    expect(actual).toBe(expectedContent);
    verified++;
  }
  expect(verified).toBe(Object.keys(expectedFiles).length);
}
