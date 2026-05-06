import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

import { readVersionInfo } from "./peVersion";
import exeVersion, {
  getFileVersion,
  getProductVersion,
  getFileVersionLocalized,
  getProductVersionLocalized,
} from "./index";

const describeOnWindows =
  process.platform === "win32" ? describe : describe.skip;

describeOnWindows("readVersionInfo", () => {
  it("reads notepad.exe version info", () => {
    const info = readVersionInfo("C:\\Windows\\System32\\notepad.exe");
    expect(info).toBeDefined();
    expect(info!.fileVersion).toHaveLength(4);
    expect(info!.fileVersion[0]).toBeGreaterThan(0);
    expect(info!.productVersion).toHaveLength(4);
    expect(info!.fileVersionString).toBeTruthy();
    expect(info!.productVersionString).toBeTruthy();
  });

  it("reads cmd.exe version info", () => {
    const info = readVersionInfo("C:\\Windows\\System32\\cmd.exe");
    expect(info).toBeDefined();
    expect(info!.fileVersion.join(".")).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  it("reads explorer.exe version info", () => {
    const info = readVersionInfo("C:\\Windows\\explorer.exe");
    expect(info).toBeDefined();
    expect(info!.fileVersion[0]).toBeGreaterThanOrEqual(10);
  });

  it("returns undefined for non-existent file", () => {
    expect(readVersionInfo("C:\\nonexistent.exe")).toBeUndefined();
  });

  it("returns undefined for non-PE file", () => {
    // Create a temp text file
    const tmp = path.join(
      fs.mkdtempSync(path.join(require("os").tmpdir(), "exever-")),
      "test.txt",
    );
    fs.writeFileSync(tmp, "not a PE file");
    expect(readVersionInfo(tmp)).toBeUndefined();
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  });
});

describeOnWindows("public API", () => {
  const notepad = "C:\\Windows\\System32\\notepad.exe";

  it("getFileVersion returns dotted version string", () => {
    const ver = getFileVersion(notepad);
    expect(ver).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  it("getProductVersion returns dotted version string", () => {
    const ver = getProductVersion(notepad);
    expect(ver).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  it("getFileVersionLocalized returns a non-empty string", () => {
    const ver = getFileVersionLocalized(notepad);
    expect(ver.length).toBeGreaterThan(0);
  });

  it("getProductVersionLocalized returns a non-empty string", () => {
    const ver = getProductVersionLocalized(notepad);
    expect(ver.length).toBeGreaterThan(0);
  });

  it("default export is getFileVersion", () => {
    expect(exeVersion(notepad)).toBe(getFileVersion(notepad));
  });

  it("returns empty string for non-existent file", () => {
    expect(getFileVersion("C:\\nonexistent.exe")).toBe("");
  });
});

describeOnWindows("cross-validation with native module", () => {
  let nativeGetInfo:
    | ((filePath: string) => {
        fileVersion: number[];
        productVersion: number[];
        fileVersionString: string;
        productVersionString: string;
      })
    | undefined;

  try {
    const winapiPath = path.resolve(
      __dirname,
      "../../../node_modules/.pnpm/winapi-bindings@https+++cod_133dce9c747207ea117c57c1f8ca67ef/node_modules/winapi-bindings",
    );
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nativeGetInfo = require(winapiPath).GetFileVersionInfo;
  } catch {
    nativeGetInfo = undefined;
  }

  const testFiles = [
    "C:\\Windows\\System32\\notepad.exe",
    "C:\\Windows\\System32\\cmd.exe",
    "C:\\Windows\\explorer.exe",
  ];

  for (const file of testFiles) {
    if (!fs.existsSync(file)) continue;

    it(`matches native output for ${path.basename(file)}`, () => {
      if (nativeGetInfo === undefined) return; // skip if native not available

      const tsInfo = readVersionInfo(file)!;
      const native = nativeGetInfo(file);

      expect(tsInfo.fileVersion.join(".")).toBe(native.fileVersion.join("."));
      expect(tsInfo.productVersion.join(".")).toBe(
        native.productVersion.join("."),
      );
    });
  }
});

describeOnWindows("benchmark", () => {
  const notepad = "C:\\Windows\\System32\\notepad.exe";
  const runs = 2000;

  it(`reads ${runs} versions from notepad.exe`, () => {
    const start = performance.now();
    for (let i = 0; i < runs; i++) readVersionInfo(notepad);
    const elapsed = performance.now() - start;
    console.log(
      `\n  TS PE parser: ${runs} reads in ${elapsed.toFixed(1)}ms (${(elapsed / runs).toFixed(3)}ms/read)`,
    );
  });
});
