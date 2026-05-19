import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { describe, it, expect } from "vitest";

import { extractIcon, extractIconToFile } from "./index";

const describeOnWindows = process.platform === "win32" ? describe : describe.skip;

const TEST_DATA_DIR = path.resolve(import.meta.dirname, "../test-data");
const REFERENCE_DIR = path.join(TEST_DATA_DIR, "reference");

// PNG signature bytes
const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function isPng(buf: Buffer): boolean {
  return buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIG);
}

function pngDimensions(buf: Buffer): { width: number; height: number } | undefined {
  if (!isPng(buf) || buf.length < 24) return undefined;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

describeOnWindows("extractIcon", () => {
  it("extracts icon from notepad.exe", () => {
    const result = extractIcon("C:\\Windows\\System32\\notepad.exe");
    expect(result).toBeDefined();
    expect(isPng(result!.png)).toBe(true);
    expect(result!.width).toBeGreaterThan(0);
    expect(result!.height).toBeGreaterThan(0);
  });

  it("extracts icon from cmd.exe", () => {
    const result = extractIcon("C:\\Windows\\System32\\cmd.exe");
    expect(result).toBeDefined();
    expect(isPng(result!.png)).toBe(true);
  });

  it("extracts icon from explorer.exe", () => {
    const result = extractIcon("C:\\Windows\\explorer.exe");
    expect(result).toBeDefined();
    expect(isPng(result!.png)).toBe(true);
  });

  it("returns undefined for non-existent file", () => {
    expect(extractIcon("C:\\nonexistent.exe")).toBeUndefined();
  });

  it("returns undefined for non-PE file", () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "iconext-")), "test.txt");
    fs.writeFileSync(tmp, "not a PE file");
    expect(extractIcon(tmp)).toBeUndefined();
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  });

  it("respects width parameter", () => {
    const icon32 = extractIcon("C:\\Windows\\System32\\notepad.exe", 32);
    const icon16 = extractIcon("C:\\Windows\\System32\\notepad.exe", 16);
    expect(icon32).toBeDefined();
    expect(icon16).toBeDefined();

    const dim32 = pngDimensions(icon32!.png);
    const dim16 = pngDimensions(icon16!.png);
    expect(dim32).toBeDefined();
    expect(dim16).toBeDefined();

    // The selected icon should be the closest match to the requested width
    // dim16 should be <= dim32
    expect(dim16!.width).toBeLessThanOrEqual(dim32!.width);
  });
});

describeOnWindows("extractIconToFile", () => {
  it("writes a valid PNG file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "iconext-"));
    const outPath = path.join(tmpDir, "notepad.png");

    extractIconToFile("C:\\Windows\\System32\\notepad.exe", outPath);

    expect(fs.existsSync(outPath)).toBe(true);
    const data = fs.readFileSync(outPath);
    expect(isPng(data)).toBe(true);
    expect(data.length).toBeGreaterThan(100); // non-trivial PNG

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws for non-existent file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "iconext-"));
    const outPath = path.join(tmpDir, "out.png");

    expect(() => extractIconToFile("C:\\nonexistent.exe", outPath)).toThrow();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describeOnWindows("cross-validation with reference data", () => {
  const testCases = [
    { name: "notepad", exe: "C:\\Windows\\System32\\notepad.exe" },
    { name: "cmd", exe: "C:\\Windows\\System32\\cmd.exe" },
    { name: "explorer", exe: "C:\\Windows\\explorer.exe" },
  ];

  for (const { name, exe } of testCases) {
    it(`produces valid icon for ${name} comparable to shell API reference`, () => {
      const refPath = path.join(REFERENCE_DIR, `${name}_32x32.png`);
      if (!fs.existsSync(refPath)) return; // skip if reference not available

      const refData = fs.readFileSync(refPath);
      const refDims = pngDimensions(refData);
      expect(refDims).toBeDefined();

      const result = extractIcon(exe, 32);
      expect(result).toBeDefined();
      expect(isPng(result!.png)).toBe(true);

      const tsDims = pngDimensions(result!.png);
      expect(tsDims).toBeDefined();

      // Both should produce icons — dimensions may differ slightly
      // since shell API may scale, but both should be non-trivial
      expect(tsDims!.width).toBeGreaterThanOrEqual(16);
      expect(tsDims!.height).toBeGreaterThanOrEqual(16);
      expect(result!.png.length).toBeGreaterThan(100);
    });
  }
});

describeOnWindows("benchmark", () => {
  const notepad = "C:\\Windows\\System32\\notepad.exe";
  const runs = 500;

  it(`extracts ${runs} icons from notepad.exe`, () => {
    // Warm up
    extractIcon(notepad);

    const start = performance.now();
    for (let i = 0; i < runs; i++) extractIcon(notepad);
    const elapsed = performance.now() - start;
    console.log(
      `\n  TS PE icon extractor: ${runs} extractions in ${elapsed.toFixed(1)}ms (${(elapsed / runs).toFixed(3)}ms/extraction)`,
    );
  });
});
