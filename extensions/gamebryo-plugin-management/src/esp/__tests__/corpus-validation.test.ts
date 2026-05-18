/**
 * Validates the TypeScript ESP parser against known-good expected output.
 * The expected output in corpus/expected-output.json was generated from
 * the original native parser and serves as the regression baseline.
 */

import * as fs from "fs";
import * as path from "path";

import { describe, it, expect } from "vitest";

import { ESPFile } from "../ESPFile";

const CORPUS_DIR = path.join(__dirname, "corpus");
const expectedPath = path.join(CORPUS_DIR, "expected-output.json");

interface ParsedOutput {
  file: string;
  gameId: string;
  isMaster: boolean;
  isLight: boolean;
  isMedium: boolean;
  isBlueprint: boolean;
  isDummy: boolean;
  author: string;
  description: string;
  masterList: string[];
  revision: number;
  parseError?: string;
}

const expectedOutputs: ParsedOutput[] = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));

describe("ESP parser corpus validation", () => {
  for (const expected of expectedOutputs) {
    const filePath = path.join(CORPUS_DIR, expected.file);
    if (!fs.existsSync(filePath)) continue;

    if (expected.parseError) {
      it(`${expected.file} should throw on parse`, async () => {
        await expect(ESPFile.open(filePath, expected.gameId)).rejects.toThrow();
      });
      continue;
    }

    describe(expected.file, () => {
      let esp: ESPFile;

      it("parses without error", async () => {
        esp = await ESPFile.open(filePath, expected.gameId);
      });

      it("isMaster matches", () => {
        expect(esp.isMaster).toBe(expected.isMaster);
      });

      it("isLight matches", () => {
        expect(esp.isLight).toBe(expected.isLight);
      });

      it("isMedium matches", () => {
        expect(esp.isMedium).toBe(expected.isMedium);
      });

      it("isBlueprint matches", () => {
        expect(esp.isBlueprint).toBe(expected.isBlueprint);
      });

      it("isDummy matches", () => {
        expect(esp.isDummy).toBe(expected.isDummy);
      });

      it("author matches", () => {
        expect(esp.author).toBe(expected.author);
      });

      it("description matches", () => {
        expect(esp.description).toBe(expected.description);
      });

      it("masterList matches", () => {
        // The original native parser used std::set (sorted order), TS parser preserves file order.
        // Compare sorted to validate content regardless of order.
        expect([...esp.masterList].sort()).toEqual([...expected.masterList].sort());
      });

      it("revision matches", () => {
        expect(esp.revision).toBe(expected.revision);
      });
    });
  }
});

describe("setLightFlag round-trip", () => {
  const nonLight = expectedOutputs.find(
    (e) => !e.isLight && !e.parseError && e.gameId === "skyrimse",
  );
  const isLight = expectedOutputs.find((e) => e.isLight && !e.parseError);

  if (nonLight) {
    it(`enables light flag on ${nonLight.file}`, async () => {
      const srcPath = path.join(CORPUS_DIR, nonLight.file);
      const tmpPath = srcPath + ".setlight.tmp";
      fs.copyFileSync(srcPath, tmpPath);

      try {
        const esp = await ESPFile.open(tmpPath, nonLight.gameId);
        expect(esp.isLight).toBe(false);

        await esp.setLightFlag(true);

        const esp2 = await ESPFile.open(tmpPath, nonLight.gameId);
        expect(esp2.isLight).toBe(true);
        expect(esp2.isMaster).toBe(nonLight.isMaster);
        expect(esp2.author).toBe(nonLight.author);
        expect([...esp2.masterList].sort()).toEqual([...nonLight.masterList].sort());
      } finally {
        fs.unlinkSync(tmpPath);
      }
    });
  }

  if (isLight) {
    it(`disables light flag on ${isLight.file}`, async () => {
      const srcPath = path.join(CORPUS_DIR, isLight.file);
      const tmpPath = srcPath + ".setlight.tmp";
      fs.copyFileSync(srcPath, tmpPath);

      try {
        const esp = await ESPFile.open(tmpPath, isLight.gameId);
        expect(esp.isLight).toBe(true);

        await esp.setLightFlag(false);

        const esp2 = await ESPFile.open(tmpPath, isLight.gameId);
        expect(esp2.isLight).toBe(false);
        expect(esp2.isMaster).toBe(isLight.isMaster);
        expect(esp2.author).toBe(isLight.author);
        expect([...esp2.masterList].sort()).toEqual([...isLight.masterList].sort());
      } finally {
        fs.unlinkSync(tmpPath);
      }
    });
  }
});
