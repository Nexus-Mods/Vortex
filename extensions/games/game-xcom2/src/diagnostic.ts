import * as path from "node:path";

import { types } from "vortex-api";

import { XCOM2_MOD_TYPES } from "./installers";

const MOD_EXT = ".XComMod";
const CHARACTER_POOL_EXT = ".bin";

/**
 * Save-file name shape — matches the installer's SAVE_NAME_RE.
 * `save_<name>` or `save<digits>`, no extension. Anchored to basename via
 * `^` because health checks see flattened deploy paths (just the basename
 * after the installer's `flatten: true`).
 */
const SAVE_NAME_RE = /^save(_[^.\\/]+|\d+)$/i;

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
const isSaveFile = (f: string) => SAVE_NAME_RE.test(path.basename(f));

const isCharacterPoolMod = (mod: types.IMod): boolean =>
  (mod.attributes.modType as string | undefined) === XCOM2_MOD_TYPES.characterPool;

const isSaveMod = (mod: types.IMod): boolean =>
  (mod.attributes.modType as string | undefined) === XCOM2_MOD_TYPES.save;

function makeCheck(
  id: string,
  name: string,
  description: string,
  checkMod: types.IModHealthCheck["checkMod"],
): types.IModHealthCheck {
  return {
    id,
    name,
    description,
    category: CATEGORY,
    severity: SEVERITY_WARNING,
    triggers: TRIGGERS,
    checkMod,
  };
}

export const healthChecks: types.IModHealthCheck[] = [
  makeCheck(
    "xcom2-mod-has-files",
    "XCOM 2 — mod has files",
    "Verifies that the installer produced at least one file.",
    async (_api, mod) => {
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
  ),

  makeCheck(
    "xcom2-has-xcommod-file",
    "XCOM 2 — output contains a .XComMod file",
    "Verifies that the install output contains at least one .XComMod file.",
    async (_api, mod) => {
      const startedAt = Date.now();
      if (isCharacterPoolMod(mod) || isSaveMod(mod)) {
        return passed(
          "xcom2-has-xcommod-file",
          "Non-.XComMod mod type; check not applicable",
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
  ),

  makeCheck(
    "xcom2-xCommods-attribute-set",
    "XCOM 2 — xComMods attribute populated",
    "Verifies that the installer recorded the xComMods attribute.",
    async (_api, mod) => {
      const startedAt = Date.now();
      if (isCharacterPoolMod(mod) || isSaveMod(mod)) {
        return passed(
          "xcom2-xCommods-attribute-set",
          "Non-.XComMod mod type; xComMods attribute check not applicable",
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
  ),

  makeCheck(
    "xcom2-character-pool-has-bin",
    "XCOM 2 — character pool output contains a .bin file",
    "Verifies that a character pool mod's install output contains at least one .bin file.",
    async (_api, mod) => {
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
  ),

  makeCheck(
    "xcom2-save-deployed",
    "XCOM 2 — save mod output contains a save file",
    "Verifies that a save mod's install output contains at least one file " +
      "with the XCOM 2 save-name shape (save_<name> or save<digits>).",
    async (_api, mod) => {
      const startedAt = Date.now();
      if (!isSaveMod(mod)) {
        return passed("xcom2-save-deployed", "Not a save mod; check not applicable", startedAt);
      }
      if (!mod.files.some(isSaveFile)) {
        return warning(
          "xcom2-save-deployed",
          "Save mod has no save-named file",
          "The save installer filters archives to files matching the XCOM 2 save-name " +
            "shape (save_<name>, save<digits>). Empty output after install means the " +
            "archive contained no recognisable save files, or the install path didn't " +
            "complete.",
          startedAt,
        );
      }
      return passed("xcom2-save-deployed", "Save mod has at least one save-named file", startedAt);
    },
  ),
];
