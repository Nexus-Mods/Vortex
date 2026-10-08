import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Which build of the game an install is.
 *
 * Classic (1.x) and Next-Gen (4.x) share a single value because nothing this
 * extension does differs between them; the Remastered build (5.0) dropped
 * DirectX 11, restructured the game tree and added an in-game mod manager.
 *
 * This module deliberately imports nothing from the Vortex API so the detection
 * logic stays unit-testable.
 */
export const W3Edition = {
  Legacy: "legacy",
  Remastered: "remastered",
} as const;
export type W3Edition = (typeof W3Edition)[keyof typeof W3Edition];

const DX11_BINARY = path.join("bin", "x64", "witcher3.exe");
const DX12_BINARY = path.join("bin", "x64_dx12", "witcher3.exe");

// Corroborating evidence only. `dlc-tombstones` is a storefront packaging
// artifact and `freecamera.ini` may move, so neither is decisive on its own.
const REMASTER_MARKERS = ["dlc-tombstones", path.join("bin", "config", "base", "freecamera.ini")];

/** Config matrix XMLs the menu-mod merger is allowed to touch, per edition. */
export const CONFIG_MATRIX_FILES = [
  "audio",
  "display",
  "gameplay",
  "gamma",
  "graphics",
  "graphicsdx11",
  "hdr",
  "hidden",
  "hud",
  "input",
  "localization",
];

// The remaster ships no graphicsdx11.xml. Merging against a base file that
// isn't there surfaces a "verify your game files" dialog the user can't act on.
const REMASTERED_CONFIG_MATRIX_FILES = CONFIG_MATRIX_FILES.filter(
  (file) => file !== "graphicsdx11",
);

export interface IEditionCapabilities {
  /** Whether the game rejects mod folder names over MAX_MOD_NAME_LENGTH. */
  enforcesModNameLength: boolean;
  /** Whether [ContentManager/Mods] can switch off everything we deploy. */
  hasLocalModMasterSwitch: boolean;
  configMatrixFiles: string[];
}

// key: W3Edition
export const EDITION_CAPABILITIES: Record<W3Edition, IEditionCapabilities> = {
  [W3Edition.Legacy]: {
    enforcesModNameLength: false,
    hasLocalModMasterSwitch: false,
    configMatrixFiles: CONFIG_MATRIX_FILES,
  },
  [W3Edition.Remastered]: {
    enforcesModNameLength: true,
    hasLocalModMasterSwitch: true,
    configMatrixFiles: REMASTERED_CONFIG_MATRIX_FILES,
  },
};

/**
 * `[ContentManager/Mods] MaxNameLength` is 64 in the shipped config. Treat that
 * as a buffer size including the terminator until a 64 character folder name has
 * actually been tested in game, so the usable length is one less.
 */
export const MAX_MOD_NAME_LENGTH = 63;

/**
 * Pure form of {@link detectEdition}, taking a path predicate so it can be
 * tested without a filesystem.
 *
 * Remastered requires positive evidence: every edition-specific code path is
 * gated on it, so anything ambiguous has to resolve to Legacy, which is the
 * behaviour the extension has always had.
 */
export function detectEditionFrom(exists: (relPath: string) => boolean): W3Edition {
  // DirectX 11 was dropped in the remaster, and that's an engine change rather
  // than a packaging one, so its presence rules the remaster out on every store.
  if (exists(DX11_BINARY)) {
    return W3Edition.Legacy;
  }
  if (exists(DX12_BINARY) || REMASTER_MARKERS.some(exists)) {
    return W3Edition.Remastered;
  }
  return W3Edition.Legacy;
}

export const DX11_EXECUTABLE = "bin/x64/witcher3.exe";
export const DX12_EXECUTABLE = "bin/x64_DX12/witcher3.exe";

/**
 * Pure form of the executable probe.
 *
 * The DirectX 11 path stays the fallback because Vortex calls the game's
 * `executable()` with no arguments to establish a default, and that default is
 * what every install predating the remaster launches through.
 */
export function determineExecutableFrom(exists: (relPath: string) => boolean): string {
  return exists(DX12_EXECUTABLE) ? DX12_EXECUTABLE : DX11_EXECUTABLE;
}

// key: game path, normalised and lowercased
const editionCache = new Map<string, W3Edition>();

const cacheKey = (gamePath: string) => path.normalize(gamePath).toLowerCase();

/**
 * Memoised so that the merge filter, the nag gate and the health checks can't
 * disagree with each other part way through an operation. Invalidated per game
 * activation rather than on a timer.
 */
export function detectEdition(gamePath: string | undefined): W3Edition {
  if (gamePath === undefined || gamePath === "") {
    return W3Edition.Legacy;
  }

  const key = cacheKey(gamePath);
  const cached = editionCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const edition = detectEditionFrom((relPath) => {
    try {
      return existsSync(path.join(gamePath, relPath));
    } catch {
      // An unreadable game directory must not look like a remaster.
      return false;
    }
  });
  editionCache.set(key, edition);
  return edition;
}

export function invalidateEditionCache(gamePath?: string) {
  if (gamePath === undefined || gamePath === "") {
    editionCache.clear();
  } else {
    editionCache.delete(cacheKey(gamePath));
  }
}

export function getEditionCapabilities(gamePath: string | undefined): IEditionCapabilities {
  return EDITION_CAPABILITIES[detectEdition(gamePath)];
}
