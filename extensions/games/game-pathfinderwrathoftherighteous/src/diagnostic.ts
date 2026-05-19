import path from "node:path";

import { types } from "vortex-api";

import { WOTR_MOD_TYPES } from "./installers";

const CATEGORY = types.HealthCheckCategory.Mods;
const TRIGGERS: types.HealthCheckTrigger[] = [
  types.HealthCheckTrigger.ModsChanged,
  types.HealthCheckTrigger.Manual,
];
const SEVERITY_INFO = types.HealthCheckSeverity.Info;
const SEVERITY_WARNING = types.HealthCheckSeverity.Warning;

/** Basenames the game engine recognises as portrait images. */
const PORTRAIT_BASENAMES = new Set(["small", "medium", "fulllength"]);
const PORTRAIT_EXTS = new Set([".png", ".jpg", ".jpeg", ".bmp", ".gif"]);

function isPortraitImage(f: string): boolean {
  const ext = path.extname(f).toLowerCase();
  const name = path.basename(f, ext).toLowerCase();
  return PORTRAIT_EXTS.has(ext) && PORTRAIT_BASENAMES.has(name);
}

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

// ---------------------------------------------------------------------------
// Generic: every mod should produce at least one file
// ---------------------------------------------------------------------------

const modHasFilesCheck: types.IModHealthCheck = {
  id: "wotr-mod-has-files",
  name: "Pathfinder: WotR — mod has files",
  description: "Verifies that the installer produced at least one file.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    if (mod.files.length === 0) {
      return warning(
        "wotr-mod-has-files",
        "Installer produced no files",
        "An installer matched but emitted zero file instructions.",
        startedAt,
      );
    }
    return passed("wotr-mod-has-files", "Install output has at least one file", startedAt);
  },
};

// ---------------------------------------------------------------------------
// UMM mods must retain their Info.json after install
// ---------------------------------------------------------------------------

const ummModHasInfoJson: types.IModHealthCheck = {
  id: "wotr-umm-mod-has-info-json",
  name: "Pathfinder: WotR — UMM mod has Info.json",
  description: "Verifies that UMM mods retain their Info.json after installation.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    const modType = mod.attributes.modType as string | undefined;
    if (modType !== WOTR_MOD_TYPES.ummMod) {
      return passed("wotr-umm-mod-has-info-json", "Not a UMM mod; check not applicable", startedAt);
    }
    const hasIt = mod.files.some((f) => path.basename(f).toLowerCase() === "info.json");
    if (!hasIt) {
      return warning(
        "wotr-umm-mod-has-info-json",
        "UMM mod missing Info.json after install",
        "The archive was identified as a UMM mod (it contained Info.json) but " +
          "the installed output does not include Info.json. This likely indicates " +
          "a root-stripping issue in the installer.",
        startedAt,
      );
    }
    return passed("wotr-umm-mod-has-info-json", "UMM mod retains Info.json", startedAt);
  },
};

// ---------------------------------------------------------------------------
// Portrait mods must contain at least one portrait image
// ---------------------------------------------------------------------------

const portraitHasImages: types.IModHealthCheck = {
  id: "wotr-portrait-has-images",
  name: "Pathfinder: WotR — portrait mod has images",
  description: "Verifies portrait mods contain at least one Small/Medium/Fulllength image.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    const modType = mod.attributes.modType as string | undefined;
    if (modType !== WOTR_MOD_TYPES.portrait) {
      return passed(
        "wotr-portrait-has-images",
        "Not a portrait mod; check not applicable",
        startedAt,
      );
    }
    const hasImage = mod.files.some(isPortraitImage);
    if (!hasImage) {
      return warning(
        "wotr-portrait-has-images",
        "Portrait mod contains no portrait images",
        "Expected at least one file named Small, Medium, or Fulllength with " +
          "a recognised image extension (.png, .jpg, .jpeg, .bmp, .gif).",
        startedAt,
      );
    }
    return passed("wotr-portrait-has-images", "Portrait mod has images", startedAt);
  },
};

// ---------------------------------------------------------------------------
// Portrait images should be inside a subdirectory (the portrait folder name)
// ---------------------------------------------------------------------------

const portraitStructure: types.IModHealthCheck = {
  id: "wotr-portrait-structure",
  name: "Pathfinder: WotR — portrait folder structure",
  description: "Verifies portrait images are inside subdirectories, not at the root.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    const modType = mod.attributes.modType as string | undefined;
    if (modType !== WOTR_MOD_TYPES.portrait) {
      return passed(
        "wotr-portrait-structure",
        "Not a portrait mod; check not applicable",
        startedAt,
      );
    }
    const portraits = mod.files.filter(isPortraitImage);
    if (portraits.length === 0) {
      return passed("wotr-portrait-structure", "No portrait images to check", startedAt);
    }
    const atRoot = portraits.filter((f) => !f.includes("/") && !f.includes("\\"));
    if (atRoot.length > 0) {
      return warning(
        "wotr-portrait-structure",
        "Portrait images found at root level",
        `${atRoot.length} portrait image(s) are at the root instead of inside ` +
          "a named subdirectory (e.g. CharacterName/Small.png). The game " +
          "expects each set of portraits in its own folder under the Portraits directory.",
        startedAt,
      );
    }
    return passed(
      "wotr-portrait-structure",
      "All portrait images are inside subdirectories",
      startedAt,
    );
  },
};

// ---------------------------------------------------------------------------
// Owlcat mods should have recognisable structure after install
// ---------------------------------------------------------------------------

const OWLCAT_DIRS = new Set(["blueprints", "content", "scripts", "localization"]);

const owlcatModStructure: types.IModHealthCheck = {
  id: "wotr-owlcat-mod-structure",
  name: "Pathfinder: WotR — Owlcat mod structure",
  description: "Verifies Owlcat template mods retain their Blueprints/Content/Scripts structure.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    const modType = mod.attributes.modType as string | undefined;
    if (modType !== WOTR_MOD_TYPES.owlcatMod) {
      return passed(
        "wotr-owlcat-mod-structure",
        "Not an Owlcat mod; check not applicable",
        startedAt,
      );
    }
    const hasMarker =
      mod.files.some((f) => {
        const parts = f.split(/[\\/]/);
        return parts.some((p) => OWLCAT_DIRS.has(p.toLowerCase()));
      }) ||
      mod.files.some((f) => path.basename(f).toLowerCase() === "owlcatmodificationmanifest.json");
    if (!hasMarker) {
      return warning(
        "wotr-owlcat-mod-structure",
        "Owlcat mod missing expected structure",
        "Expected at least one of: Blueprints/, Content/, Scripts/, Localization/ " +
          "directories, or OwlcatModificationManifest.json. The installer may have " +
          "stripped too many path levels.",
        startedAt,
      );
    }
    return passed("wotr-owlcat-mod-structure", "Owlcat mod has recognisable structure", startedAt);
  },
};

export const healthChecks: types.IModHealthCheck[] = [
  modHasFilesCheck,
  ummModHasInfoJson,
  portraitHasImages,
  portraitStructure,
  owlcatModStructure,
];
