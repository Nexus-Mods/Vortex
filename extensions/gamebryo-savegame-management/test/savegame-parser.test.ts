import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { SaveGameData } from "../src/savegame/GamebryoSaveGame";
import { parseSaveGame } from "../src/savegame/GamebryoSaveGame";

const SAVES_DIR = path.join(__dirname, "saves");
const EXPECTED_DIR = path.join(__dirname, "expected");
const GAME_DIRS = [
  "oblivion",
  "skyrim",
  "skyrimse",
  "fallout3",
  "falloutnv",
  "fallout4",
];
const SAVE_EXTENSIONS = [".ess", ".fos"];

interface ExpectedData {
  fileName: string;
  error?: string;
  quick: {
    characterName: string;
    characterLevel: number;
    location: string;
    saveNumber: number;
    creationTime: number;
    playTime: string;
  };
  full: {
    characterName: string;
    characterLevel: number;
    location: string;
    saveNumber: number;
    creationTime: number;
    playTime: string;
    plugins: string[];
    screenshotSize?: { width: number; height: number };
    screenshotHash?: string;
    screenshotLength?: number;
  };
}

function trimAtNull(s: unknown): unknown {
  if (typeof s !== "string") return s;
  const idx = s.indexOf("\u0000");
  return idx >= 0 ? s.substring(0, idx) : s;
}

for (const game of GAME_DIRS) {
  describe(`${game} saves`, () => {
    const saveDir = path.join(SAVES_DIR, game);
    const files = fs
      .readdirSync(saveDir)
      .filter((f) => SAVE_EXTENSIONS.includes(path.extname(f).toLowerCase()));

    for (const file of files) {
      const baseName = path.basename(file, path.extname(file));
      const expectedPath = path.join(EXPECTED_DIR, game, `${baseName}.json`);

      if (!fs.existsSync(expectedPath)) continue;
      const expected: ExpectedData = JSON.parse(
        fs.readFileSync(expectedPath, "utf8"),
      );
      if (expected.error) continue;

      describe(file, () => {
        it("quick read", () => {
          const quick: SaveGameData = parseSaveGame(
            path.join(saveDir, file),
            true,
          );
          const eq = expected.quick;
          expect(trimAtNull(quick.characterName)).toBe(eq.characterName);
          expect(quick.characterLevel).toBe(eq.characterLevel);
          expect(trimAtNull(quick.location)).toBe(eq.location);
          expect(quick.saveNumber).toBe(eq.saveNumber);
          // creationTime is skipped: Oblivion uses local timezone via Date(),
          // FO3/NV falls back to file mtime — both are environment-dependent
          expect(quick.playTime).toBe(eq.playTime);
        });

        it("full read", () => {
          const full: SaveGameData = parseSaveGame(
            path.join(saveDir, file),
            false,
          );
          const ef = expected.full;
          expect(trimAtNull(full.characterName)).toBe(ef.characterName);
          expect(full.characterLevel).toBe(ef.characterLevel);
          expect(trimAtNull(full.location)).toBe(ef.location);
          expect(full.saveNumber).toBe(ef.saveNumber);
          expect(full.playTime).toBe(ef.playTime);
          expect(full.plugins).toEqual(ef.plugins);

          if (ef.screenshotSize) {
            expect(full.screenshotSize.width).toBe(ef.screenshotSize.width);
            expect(full.screenshotSize.height).toBe(ef.screenshotSize.height);
          }

          if (ef.screenshotHash) {
            const hash = crypto
              .createHash("sha256")
              .update(full.screenshot)
              .digest("hex");
            expect(hash).toBe(ef.screenshotHash);
            expect(full.screenshot.length).toBe(ef.screenshotLength);
          }
        });
      });
    }
  });
}
