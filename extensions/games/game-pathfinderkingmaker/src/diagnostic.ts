/**
 * Health checks for Pathfinder: Kingmaker.
 *
 * Types are defined inline because the HealthCheck type surface is not yet
 * exported from `vortex-api` on master.
 */
import * as path from "path";

import { MOD_TYPES } from "./installers";

interface IModCheckContext {
  files: string[];
  attributes: Record<string, unknown>;
}

interface IHealthCheckResult {
  checkId: string;
  status: "passed" | "failed" | "warning" | "error";
  severity: string;
  message: string;
  details?: string;
  executionTime: number;
  timestamp: Date;
}

interface IModHealthCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  triggers: string[];
  checkMod: (api: unknown, mod: IModCheckContext) => Promise<IHealthCheckResult>;
}

const CATEGORY = "mods";
const TRIGGERS = ["mods-changed", "manual"];

function passed(checkId: string, message: string, startedAt: number): IHealthCheckResult {
  return {
    checkId,
    status: "passed",
    severity: "info",
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
): IHealthCheckResult {
  return {
    checkId,
    status: "warning",
    severity: "warning",
    message,
    details,
    executionTime: Date.now() - startedAt,
    timestamp: new Date(),
  };
}

const PORTRAIT_FILES = new Set(["small.png", "medium.png", "fulllength.png"]);

function isPortraitFile(f: string): boolean {
  return PORTRAIT_FILES.has(path.basename(f).toLowerCase());
}

export const healthChecks: IModHealthCheck[] = [
  {
    id: "pfk-mod-has-files",
    name: "Pathfinder: Kingmaker -- mod has files",
    description: "Verifies that the installer produced at least one file.",
    category: CATEGORY,
    severity: "warning",
    triggers: TRIGGERS,
    checkMod: async (_api, mod) => {
      const startedAt = Date.now();
      if (mod.files.length === 0) {
        return warning(
          "pfk-mod-has-files",
          "Installer produced no files",
          "An installer matched but emitted zero file instructions.",
          startedAt,
        );
      }
      return passed("pfk-mod-has-files", "Install output has at least one file", startedAt);
    },
  },
  {
    id: "pfk-portrait-has-canonical-files",
    name: "Pathfinder: Kingmaker -- portrait has canonical files",
    description:
      "Verifies that a portrait mod contains at least one of the canonical " +
      "portrait files (Small.png, Medium.png, Fulllength.png).",
    category: CATEGORY,
    severity: "warning",
    triggers: TRIGGERS,
    checkMod: async (_api, mod) => {
      const startedAt = Date.now();
      const modType = mod.attributes.modType as string | undefined;
      if (modType !== MOD_TYPES.portrait) {
        return passed(
          "pfk-portrait-has-canonical-files",
          "Not a portrait mod; check not applicable",
          startedAt,
        );
      }
      if (!mod.files.some(isPortraitFile)) {
        return warning(
          "pfk-portrait-has-canonical-files",
          "Portrait mod has no canonical portrait files",
          "The portrait installer matched this archive but the install output " +
            "contains none of Small.png, Medium.png, or Fulllength.png. " +
            "The game requires these exact filenames in each portrait subfolder.",
          startedAt,
        );
      }
      return passed(
        "pfk-portrait-has-canonical-files",
        "Portrait mod contains canonical portrait files",
        startedAt,
      );
    },
  },
  {
    id: "pfk-save-has-zks",
    name: "Pathfinder: Kingmaker -- save mod has .zks files",
    description: "Verifies that a save mod contains at least one .zks save file.",
    category: CATEGORY,
    severity: "warning",
    triggers: TRIGGERS,
    checkMod: async (_api, mod) => {
      const startedAt = Date.now();
      const modType = mod.attributes.modType as string | undefined;
      if (modType !== MOD_TYPES.save) {
        return passed("pfk-save-has-zks", "Not a save mod; check not applicable", startedAt);
      }
      const hasZks = mod.files.some((f) => path.extname(f).toLowerCase() === ".zks");
      if (!hasZks) {
        return warning(
          "pfk-save-has-zks",
          "Save mod has no .zks file",
          "The save installer matched this archive but the install output " +
            "contains no .zks save file. Pathfinder: Kingmaker uses .zks " +
            "as its save file format.",
          startedAt,
        );
      }
      return passed("pfk-save-has-zks", "Save mod contains .zks file(s)", startedAt);
    },
  },
];
