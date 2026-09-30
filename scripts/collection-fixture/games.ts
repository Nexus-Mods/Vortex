/**
 * The games the fixture can model. Each entry says what a fake install needs on disk to pass the
 * game extension's discovery check, and how a mod's staging folder is laid out for that game.
 *
 * The Stardew Valley and Skyrim SE file lists mirror the E2E fake game in
 * `packages/e2e/src/fixtures/game-setup/fake-game.ts`; Fallout 4 follows
 * `extensions/games/game-fallout4/src/index.js` (`requiredFiles: ["Fallout4.exe"]`).
 */
import type { GameId } from "./types";

export interface IGameConfig {
  id: GameId;
  name: string;
  /** the nexusmods.com domain, what collection rules carry in `reference.repo.gameId` */
  domainName: string;
  executable: string;
  requiredFiles: string[];
  directories: string[];
  optionalFiles: Array<{ path: string; content: string | Buffer }>;
  /**
   * "gamebryo": a plugin per mod plus loose assets, deployed into Data/ (mergeMods)
   * "smapi": each mod is its own folder with a manifest.json, deployed into Mods/
   */
  layout: "gamebryo" | "smapi";
}

/** A minimal PE header, enough for the executable type checks discovery runs. */
export function fakeExecutable(): Buffer {
  const buffer = Buffer.alloc(512);
  buffer.write("MZ", 0);
  buffer.writeUInt32LE(0x40, 0x3c);
  buffer.write("PE\0\0", 0x40);
  buffer.writeUInt16LE(0x8664, 0x44);
  return buffer;
}

const isWindows = process.platform === "win32";

export const GAMES: Record<GameId, IGameConfig> = {
  stardewvalley: {
    id: "stardewvalley",
    name: "Stardew Valley",
    domainName: "stardewvalley",
    executable: isWindows ? "Stardew Valley.exe" : "StardewValley",
    requiredFiles: [
      isWindows ? "Stardew Valley.exe" : "StardewValley",
      "Stardew Valley.deps.json",
      "Stardew Valley.dll",
      "Stardew Valley.pdb",
      "Stardew Valley.runtimeconfig.json",
    ],
    directories: ["Content", "Content/Characters", "Content/Data", "Content/Maps", "Mods"],
    optionalFiles: [
      { path: "steam_appid.txt", content: "413150" },
      { path: "Content/XACT/FarmerSounds.xwb", content: "FAKE_AUDIO_FILE" },
    ],
    layout: "smapi",
  },
  skyrimse: {
    id: "skyrimse",
    name: "Skyrim Special Edition",
    domainName: "skyrimspecialedition",
    executable: "SkyrimSE.exe",
    requiredFiles: ["SkyrimSE.exe", "SkyrimSELauncher.exe", "binkw64.dll", "steam_api64.dll"],
    directories: ["Data", "Data/Scripts", "Data/Meshes", "Data/Textures"],
    optionalFiles: [
      { path: "steam_appid.txt", content: "489830" },
      { path: "Data/Skyrim.esm", content: "TES4\x00\x00\x00\x00" },
    ],
    layout: "gamebryo",
  },
  fallout4: {
    id: "fallout4",
    name: "Fallout 4",
    domainName: "fallout4",
    executable: "Fallout4.exe",
    requiredFiles: ["Fallout4.exe", "Fallout4Launcher.exe", "steam_api64.dll"],
    directories: ["Data", "Data/Scripts", "Data/Meshes", "Data/Textures"],
    optionalFiles: [
      { path: "steam_appid.txt", content: "377160" },
      { path: "Data/Fallout4.esm", content: "TES4\x00\x00\x00\x00" },
    ],
    layout: "gamebryo",
  },
};

export const GAME_IDS: GameId[] = ["stardewvalley", "skyrimse", "fallout4"];

export function isGameId(value: string): value is GameId {
  return GAME_IDS.some((id) => id === value);
}
