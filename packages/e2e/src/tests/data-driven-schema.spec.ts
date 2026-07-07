/**
 * Focused schema and resolver coverage for data-driven YAML `deploy.expectedFiles`.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { resolveExpectedDeployFiles } from "../helpers/data-driven/manageDownloadAndDeploy";
import { loadDataDrivenTestCases, resolveExpectedFiles } from "../helpers/data-driven/testCases";

const BASE_CASE = `
id: schema-case
flow: manage-download-and-deploy
suite: Data-driven schema
title: validates expectedFiles
download:
  modUrl: https://www.nexusmods.com/gothic1remake/mods/3
  expectedModRow: Example Mod
`;

test.describe("data-driven schema deploy.expectedFiles", () => {
  test("keeps flat expectedFiles lists compatible", () => {
    const rootDir = writeCase(`
${BASE_CASE}
deploy:
  expectedFiles:
    - G1R/Binaries/Win64/dwmapi.dll
    - G1R/Binaries/Win64/UE4SS.dll
`);

    const [testCase] = loadDataDrivenTestCases(rootDir);

    expect(testCase?.deploy?.expectedFiles).toEqual([
      "G1R/Binaries/Win64/dwmapi.dll",
      "G1R/Binaries/Win64/UE4SS.dll",
    ]);
  });

  test("accepts expectedFiles platform objects", () => {
    const rootDir = writeCase(`
${BASE_CASE}
deploy:
  expectedFiles:
    common:
      - Mods/Shared.dll
    linux:
      - StardewModdingAPI
`);

    const [testCase] = loadDataDrivenTestCases(rootDir);

    expect(testCase?.deploy?.expectedFiles).toEqual({
      common: ["Mods/Shared.dll"],
      linux: ["StardewModdingAPI"],
    });
  });

  test("rejects unknown expectedFiles platform keys", () => {
    const rootDir = writeCase(`
${BASE_CASE}
deploy:
  expectedFiles:
    common:
      - Mods/Shared.dll
    android:
      - Mods/Mobile.dll
`);

    expect(() => loadDataDrivenTestCases(rootDir)).toThrow(/deploy\.expectedFiles: Invalid input/i);
  });
});

test.describe("resolveExpectedFiles", () => {
  test("merges common and active platform files and removes duplicates in order", () => {
    expect(
      resolveExpectedFiles(
        {
          common: ["Mods/Shared.dll", "StardewModdingAPI"],
          linux: ["StardewModdingAPI", "Mods/LinuxOnly.dll"],
          windows: ["StardewModdingAPI.exe"],
        },
        "linux",
      ),
    ).toEqual(["Mods/Shared.dll", "StardewModdingAPI", "Mods/LinuxOnly.dll"]);
  });

  test("returns a copy of flat expectedFiles lists", () => {
    const input = ["Mods/Shared.dll"];

    const resolved = resolveExpectedFiles(input, "windows");

    expect(resolved).toEqual(["Mods/Shared.dll"]);
    expect(resolved).not.toBe(input);
  });

  test("throws when a platform object resolves to no files for the active platform", () => {
    expect(() => resolveExpectedFiles({ linux: ["StardewModdingAPI"] }, "windows")).toThrow(
      /resolved to no files for platform: windows/,
    );
  });
});

test.describe("manage-download-and-deploy expectedFiles registration", () => {
  test("resolves deploy expectedFiles before deployment receives file paths", () => {
    expect(
      resolveExpectedDeployFiles(
        {
          expectedFiles: {
            common: ["Mods/Shared.dll", "StardewModdingAPI"],
            windows: ["StardewModdingAPI", "StardewModdingAPI.exe"],
          },
          message: "Expected files to deploy",
        },
        "windows",
      ),
    ).toEqual(["Mods/Shared.dll", "StardewModdingAPI", "StardewModdingAPI.exe"]);
  });

  test("fails registration resolution when deploy expectedFiles are empty for the platform", () => {
    expect(() =>
      resolveExpectedDeployFiles({ expectedFiles: { linux: ["StardewModdingAPI"] } }, "windows"),
    ).toThrow(/resolved to no files for platform: windows/);
  });
});

function writeCase(source: string): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-data-driven-schema-"));
  const caseDir = path.join(rootDir, "games", "gothic1remake");
  fs.mkdirSync(caseDir, { recursive: true });
  fs.writeFileSync(path.join(caseDir, "case.yml"), source.trimStart());
  return rootDir;
}
