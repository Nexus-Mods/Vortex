import path from "path";

import { log } from "@nexusmods/vortex-api";
import type { types } from "@nexusmods/vortex-api";

export const DARKSOULS2_GAME_ID = "darksouls2";

/**
 * Dark Souls II keeps everything one level below the install root, in
 * `<installroot>/Game/`. The game's `queryModPath()` deliberately stays `"."`
 * (see index.ts), so every destination this module emits carries the `Game/`
 * prefix itself.
 */
export const GAME_DIR = "Game";

/** Where DS2 Lighting Engine / iGP11 read replacement textures from. */
export const TEX_OVERRIDE_DIR = "tex_override";

/**
 * Installer priority slots. Vortex dispatches lower numbers first, so the most
 * specific match needs the lowest number.
 *
 *   gameDir (15)  — archives anchored on the game executable's directory.
 *                   Must beat `modtype-dinput` (50), which would otherwise
 *                   leave these archives to the core fallback.
 *   textures (25) — all-texture archives. Must beat `modtype-gedosato` (50),
 *                   which claims them and then silently never deploys them on a
 *                   machine without GeDoSaTo.
 *
 * 20 and 30 are left free for the savegame and content-routing installers the
 * handover plans next, so those can slot in without renumbering.
 */
export const DARKSOULS2_PRIORITIES = {
  gameDir: 15,
  textures: 25,
} as const;

/**
 * Proxy DLLs that only load when they sit beside the executable. A directory
 * containing one of these is therefore unambiguously an archive wrapper rather
 * than a ModEngine override directory, which is what makes it safe to strip.
 *
 * `dinput8.dll` is deliberately absent: it belongs to the bundled
 * `modtype-dinput` extension, which already routes it correctly via
 * `path.dirname(game.executable)`. Claiming it here would break the ~78
 * ModEngine mods that depend on that path.
 */
export const PROXY_DLLS = [
  "dxgi.dll",
  "d3d11.dll",
  "d3d9.dll",
  "d3d12.dll",
  "winmm.dll",
  "version.dll",
];

/**
 * Launchers that must sit beside `DarkSoulsII.exe` because they look for the
 * game in their own directory and load their payload relative to themselves.
 *
 * Unlike the proxy DLLs above, there is no structural signal for these: a
 * launcher executable is indistinguishable from a standalone modding tool by
 * archive shape alone. Measured against the 1244-archive corpus, "any .exe at
 * the archive root" matches 27 archives of which all but a couple are save
 * editors, unpackers and backup tools that must NOT be forced into `Game/`;
 * "an .exe at the root plus a DLL in a subfolder" matches a single archive, and
 * that one is a Qt GUI application whose subfolder DLLs are Qt plugins.
 *
 * So this list is deliberately an explicit allow-list keyed on known filenames
 * rather than a heuristic. Adding a launcher means adding its filename here.
 *
 * `ds2sc_launcher.exe` — Dark Souls II SotFS Seamless Co-op. Its own install
 * instructions say to extract into
 * `...\Dark Souls II Scholar of the First Sin\Game`, and the binary contains
 * `SeamlessCoop//ds2sc.dll` plus `Failed to find "DarkSoulsII.exe"`, so it
 * resolves both its payload and the game relative to itself.
 */
export const LAUNCHER_EXECUTABLES = ["ds2sc_launcher.exe"];

/**
 * Filenames that mark an archive as relative to the game executable's
 * directory. Whichever one is found anchors the re-rooting.
 */
export const GAME_DIR_MARKERS = [...PROXY_DLLS, ...LAUNCHER_EXECUTABLES];

/** The loader `modtype-dinput` owns. Its presence makes us stand down. */
const DINPUT_DLL = "dinput8.dll";

const TEXTURE_EXTENSIONS = [".dds", ".png"];

const notSupported: types.ISupportedResult = { supported: false, requiredFiles: [] };

function isDirectory(filePath: string): boolean {
  return filePath.endsWith(path.sep);
}

function dataFilesOf(files: string[]): string[] {
  return files.filter((filePath) => !isDirectory(filePath));
}

function basenameLower(filePath: string): string {
  return path.basename(filePath).toLowerCase();
}

/**
 * Every result this module produces ends by pinning the mod to the default
 * modType. Without it, `modtype-gedosato`'s modType test matches any `.dds`
 * destination regardless of prefix; on a machine without GeDoSaTo that
 * modType's path resolves to undefined and the mod is dropped from the deploy
 * pass with no error and no warning.
 */
function setDefaultModType(): types.IInstruction {
  return { type: "setmodtype", value: "" };
}

// --- archives anchored on the game executable's directory -------------------

function findGameDirMarker(files: string[]): string | undefined {
  return dataFilesOf(files).find((filePath) => GAME_DIR_MARKERS.includes(basenameLower(filePath)));
}

function hasDinput(files: string[]): boolean {
  return dataFilesOf(files).some((filePath) => basenameLower(filePath) === DINPUT_DLL);
}

/**
 * Claims archives built around a proxy-DLL injector (DS2 Lighting Engine and
 * friends) or a known launcher (Seamless Co-op). Declines anything carrying
 * `dinput8.dll` so ModEngine archives keep going to `modtype-dinput`
 * byte-for-byte as they do today.
 */
export function testGameDir(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== DARKSOULS2_GAME_ID || hasDinput(files)) {
    return Promise.resolve(notSupported);
  }
  const refFile = findGameDirMarker(files);
  if (refFile === undefined) {
    return Promise.resolve(notSupported);
  }
  return Promise.resolve({ supported: true, requiredFiles: [refFile] });
}

/**
 * Re-roots the archive on the marker's own directory and prefixes everything
 * with `Game/`, so the loader lands beside `DarkSoulsII.exe` and its data tree
 * lands beside it. This mirrors `modtype-dinput`'s installer, which anchors on
 * `path.dirname(refFile)` for the same reason.
 *
 * Anchoring on the marker rather than on a common root is deliberate: it drops
 * stray files that sit outside the marker's directory (a readme at the true
 * archive root, say), which is exactly what `modtype-dinput` does.
 */
export function installGameDir(files: string[]): Promise<types.IInstallResult> {
  const refFile = findGameDirMarker(files);
  if (refFile === undefined) {
    // testGameDir guarantees this cannot happen; fail loudly rather than
    // silently emitting an empty mod if that ever stops being true.
    return Promise.reject(new Error("no game-directory marker found in archive"));
  }
  const basePath = path.dirname(refFile);

  const instructions: types.IInstruction[] = dataFilesOf(files)
    .filter((filePath) => basePath === "." || filePath.startsWith(basePath + path.sep))
    .map((filePath) => ({
      type: "copy" as const,
      source: filePath,
      destination: path.join(GAME_DIR, path.relative(basePath, filePath)),
    }));

  instructions.push(setDefaultModType());
  return Promise.resolve({ instructions });
}

// --- textures ---------------------------------------------------------------

/**
 * Mirrors `modtype-gedosato`'s predicate exactly, directory entries included,
 * so we claim precisely the set it would have claimed and nothing more.
 */
function isTexture(filePath: string): boolean {
  return isDirectory(filePath) || TEXTURE_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

export function allTextures(files: string[]): boolean {
  return files.every(isTexture);
}

/**
 * Claims all-texture archives, but only when GeDoSaTo is absent. With GeDoSaTo
 * installed we decline and `modtype-gedosato` keeps today's behaviour exactly.
 *
 * `gedosatoInstalled` is injected rather than looked up here so this module
 * stays free of Vortex runtime state and can be unit tested directly.
 */
export function testTextures(
  files: string[],
  gameId: string,
  gedosatoInstalled: boolean,
): Promise<types.ISupportedResult> {
  if (gameId !== DARKSOULS2_GAME_ID || gedosatoInstalled) {
    return Promise.resolve(notSupported);
  }
  const dataFiles = dataFilesOf(files);
  if (dataFiles.length === 0 || !allTextures(files)) {
    return Promise.resolve(notSupported);
  }
  return Promise.resolve({ supported: true, requiredFiles: [] });
}

/**
 * Flattens every texture into `Game/tex_override/`, discarding archive nesting.
 * The DS2 Lighting Engine documentation says to extract textures "directly
 * into" that folder, and nested textures are not read.
 */
export function installTextures(files: string[]): Promise<types.IInstallResult> {
  const dataFiles = dataFilesOf(files);

  const seen = new Map<string, string>();
  const collisions: string[] = [];
  for (const filePath of dataFiles) {
    const name = basenameLower(filePath);
    const first = seen.get(name);
    if (first !== undefined) {
      collisions.push(`${first} / ${filePath}`);
    } else {
      seen.set(name, filePath);
    }
  }
  if (collisions.length > 0) {
    // Flattening maps these onto one destination, so the last one written wins.
    // Warn rather than fail: the mod still installs, and refusing it would be
    // worse than the current behaviour of not deploying at all.
    log("warn", "darksouls2: textures collide when flattened", { collisions });
  }

  const instructions: types.IInstruction[] = dataFiles.map((filePath) => ({
    type: "copy" as const,
    source: filePath,
    destination: path.join(GAME_DIR, TEX_OVERRIDE_DIR, path.basename(filePath)),
  }));

  instructions.push(setDefaultModType());
  return Promise.resolve({ instructions });
}
