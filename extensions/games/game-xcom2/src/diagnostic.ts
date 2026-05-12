import * as path from "node:path";

import { types } from "vortex-api";

import { XCOM2_MOD_TYPES } from "./installers";

const MOD_EXT = ".XComMod";
const CHARACTER_POOL_EXT = ".bin";

const CATEGORY = types.HealthCheckCategory.Mods;
const TRIGGERS: types.HealthCheckTrigger[] = [
  types.HealthCheckTrigger.ModsChanged,
  types.HealthCheckTrigger.Manual,
];
const SEVERITY_INFO = types.HealthCheckSeverity.Info;
const SEVERITY_WARNING = types.HealthCheckSeverity.Warning;

function passed(checkId: string, message: string, startedAt: number): types.IHealthCheckResult {
  return {
    checkId,
    status: "passed",
    severity: SEVERITY_INFO,
    message,
    executionTime: Date.now() - startedAt,
    timestamp: new Date(),
  };
}

function warning(
  checkId: string,
  message: string,
  details: string,
  startedAt: number,
): types.IHealthCheckResult {
  return {
    checkId,
    status: "warning",
    severity: SEVERITY_WARNING,
    message,
    details,
    executionTime: Date.now() - startedAt,
    timestamp: new Date(),
  };
}

const isXComMod = (f: string) => path.extname(f).toLowerCase() === MOD_EXT.toLowerCase();
const isCharacterPoolBin = (f: string) =>
  path.extname(f).toLowerCase() === CHARACTER_POOL_EXT.toLowerCase();

/**
 * True for mods deployed via the character-pool installer. `.XComMod`-shape
 * health checks below skip these since character pools have no descriptor.
 */
const isCharacterPoolMod = (mod: types.IMod): boolean =>
  (mod.attributes.modType as string | undefined) === XCOM2_MOD_TYPES.characterPool;

/**
 * Fails when an install produced zero files — typically means the installer's
 * filter logic ate every entry (e.g. directory-only filter mis-applied).
 */
const modHasFilesCheck: types.IModHealthCheck = {
  id: "xcom2-mod-has-files",
  name: "XCOM 2 — mod has files",
  description: "Verifies that the installer produced at least one file.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    if (mod.files.length === 0) {
      return warning(
        "xcom2-mod-has-files",
        "Installer produced no files",
        "An installer matched but emitted zero file instructions.",
        startedAt,
      );
    }
    return passed("xcom2-mod-has-files", "Install output has at least one file", startedAt);
  },
};

/**
 * The XCOM 2 installer's testSupported requires at least one `.XComMod` file
 * and the install function copies the folder around that file. Absence in the
 * install output means the installer matched something it shouldn't have, or
 * the copy loop dropped the canonical mod descriptor. Skipped for character
 * pool mods — those have no `.XComMod`.
 */
const hasXComModFileCheck: types.IModHealthCheck = {
  id: "xcom2-has-xcommod-file",
  name: "XCOM 2 — output contains a .XComMod file",
  description: "Verifies that the install output contains at least one .XComMod file.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    if (isCharacterPoolMod(mod)) {
      return passed(
        "xcom2-has-xcommod-file",
        "Character pool mod; .XComMod check not applicable",
        startedAt,
      );
    }
    if (!mod.files.some(isXComMod)) {
      return warning(
        "xcom2-has-xcommod-file",
        "No .XComMod file in install output",
        "The XCOM 2 installer only matches archives containing at least one .XComMod " +
          "descriptor and copies the surrounding folder. Its absence after install means " +
          "the installer matched non-XCOM content or the copy step dropped the descriptor.",
        startedAt,
      );
    }
    return passed("xcom2-has-xcommod-file", "Install output contains a .XComMod file", startedAt);
  },
};

/**
 * The .XComMod install function always emits an `xComMods` attribute listing
 * the mod descriptor basenames. An empty or missing value means the install
 * path didn't complete end-to-end (e.g. silent throw before the attribute
 * push). Skipped for character pool mods — that installer doesn't set this
 * attribute.
 */
const xComModsAttributeCheck: types.IModHealthCheck = {
  id: "xcom2-xCommods-attribute-set",
  name: "XCOM 2 — xComMods attribute populated",
  description: "Verifies that the installer recorded the xComMods attribute.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    if (isCharacterPoolMod(mod)) {
      return passed(
        "xcom2-xCommods-attribute-set",
        "Character pool mod; xComMods attribute check not applicable",
        startedAt,
      );
    }
    const value = mod.attributes.xComMods;
    if (!Array.isArray(value) || value.length === 0) {
      return warning(
        "xcom2-xCommods-attribute-set",
        "xComMods attribute missing or empty",
        "The XCOM 2 installer always emits xComMods as a non-empty array of mod " +
          "descriptor basenames. Its absence means the install path didn't complete.",
        startedAt,
      );
    }
    return passed("xcom2-xCommods-attribute-set", "xComMods attribute populated", startedAt);
  },
};

/**
 * The character-pool installer filters the archive to `.bin` only and flattens
 * to `Importable/`. The install output for a character-pool mod must contain
 * at least one `.bin` file; absence means the filter dropped everything (the
 * archive had no `.bin`) or the install path didn't complete.
 */
const characterPoolHasBinCheck: types.IModHealthCheck = {
  id: "xcom2-character-pool-has-bin",
  name: "XCOM 2 — character pool output contains a .bin file",
  description:
    "Verifies that a character pool mod's install output contains at least one .bin file.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    if (!isCharacterPoolMod(mod)) {
      return passed(
        "xcom2-character-pool-has-bin",
        "Not a character pool mod; check not applicable",
        startedAt,
      );
    }
    if (!mod.files.some(isCharacterPoolBin)) {
      return warning(
        "xcom2-character-pool-has-bin",
        "Character pool mod has no .bin file",
        "The character-pool installer filters archives to .bin only. Empty output " +
          "after install means the archive contained no recognisable character pool " +
          "files, or the install path didn't complete.",
        startedAt,
      );
    }
    return passed(
      "xcom2-character-pool-has-bin",
      "Character pool mod has at least one .bin file",
      startedAt,
    );
  },
};

export const healthChecks: types.IModHealthCheck[] = [
  modHasFilesCheck,
  hasXComModFileCheck,
  xComModsAttributeCheck,
  characterPoolHasBinCheck,
];
