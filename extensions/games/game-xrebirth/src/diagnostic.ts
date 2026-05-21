import * as path from "node:path";

import { types, util } from "@nexusmods/vortex-api";

import { XREBIRTH_MOD_TYPES } from "./installers";
import { XREBIRTH_STOP_PATTERNS } from "./stopPatterns";

const TAGGED_NON_CONTENT_XML = new Set<string>([
  XREBIRTH_MOD_TYPES.savegame,
  XREBIRTH_MOD_TYPES.shaderInjector,
  XREBIRTH_MOD_TYPES.utility,
  XREBIRTH_MOD_TYPES.documentation,
  XREBIRTH_MOD_TYPES.savePatch,
]);

const CATEGORY = types.HealthCheckCategory.Mods;
const TRIGGERS: types.HealthCheckTrigger[] = [
  types.HealthCheckTrigger.ModsChanged,
  types.HealthCheckTrigger.Manual,
];
const SEVERITY_INFO = types.HealthCheckSeverity.Info;
const SEVERITY_WARNING = types.HealthCheckSeverity.Warning;

// Hoisted: the stopPatterns list is constant, so compile once instead of every
// check invocation.
const STOP_PATTERN_REGEXES = util.compileStopPatterns(XREBIRTH_STOP_PATTERNS);

function isContentXmlMod(mod: types.IMod): boolean {
  return mod.files.some((f) => path.basename(f).toLowerCase() === "content.xml");
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

/**
 * Fails when an install produced zero files — typically means the installer's
 * filter logic ate every entry (e.g. directory-only filter mis-applied).
 */
const modHasFilesCheck: types.IModHealthCheck = {
  id: "xrebirth-mod-has-files",
  name: "X Rebirth — mod has files",
  description: "Verifies that the installer produced at least one file.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    if (mod.files.length === 0) {
      return warning(
        "xrebirth-mod-has-files",
        "Installer produced no files",
        "An installer matched but emitted zero file instructions.",
        startedAt,
      );
    }
    return passed("xrebirth-mod-has-files", "Install output has at least one file", startedAt);
  },
};

/**
 * For content.xml mods: the install path always emits a `customFileName`
 * attribute from the XML's `name` field. Its absence after install indicates
 * the install function didn't run end-to-end (e.g. silent throw).
 */
const contentXmlCustomFileNameCheck: types.IModHealthCheck = {
  id: "xrebirth-content-xml-customFileName",
  name: "X Rebirth — content.xml carries customFileName",
  description: "Verifies that content.xml mods record their declared name.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    if (!isContentXmlMod(mod)) {
      return passed(
        "xrebirth-content-xml-customFileName",
        "Not a content.xml mod; check not applicable",
        startedAt,
      );
    }
    if (mod.attributes.customFileName === undefined) {
      return warning(
        "xrebirth-content-xml-customFileName",
        "content.xml mod missing customFileName attribute",
        "The content.xml installer always emits customFileName from the XML's name field. " +
          "Its absence means the install path didn't complete.",
        startedAt,
      );
    }
    return passed(
      "xrebirth-content-xml-customFileName",
      "content.xml mod has customFileName",
      startedAt,
    );
  },
};

/**
 * The mod must look like *some* recognisable X Rebirth shape: a content.xml
 * mod, a drop-in matching the game's stopPatterns, or one of the tagged
 * non-content modTypes (savegame, utility, shader, etc.). Otherwise the
 * installer matched something but it isn't actually X Rebirth content.
 */
const modShapeRecognisedCheck: types.IModHealthCheck = {
  id: "xrebirth-mod-shape-recognised",
  name: "X Rebirth — mod has a recognisable shape",
  description:
    "Verifies the install output is content.xml, matches stopPatterns, or is tagged with a known modType.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    if (isContentXmlMod(mod)) {
      return passed("xrebirth-mod-shape-recognised", "Recognised as content.xml mod", startedAt);
    }
    const modType = mod.attributes.modType as string | undefined;
    if (modType !== undefined && TAGGED_NON_CONTENT_XML.has(modType)) {
      return passed(
        "xrebirth-mod-shape-recognised",
        `Recognised by modType: ${modType}`,
        startedAt,
      );
    }
    if (mod.files.some((f) => STOP_PATTERN_REGEXES.some((re) => re.test(f)))) {
      return passed("xrebirth-mod-shape-recognised", "Recognised by stopPatterns match", startedAt);
    }
    return warning(
      "xrebirth-mod-shape-recognised",
      "Install output has no recognisable X Rebirth shape",
      "No content.xml, no stop-pattern matches, and no recognised modType.",
      startedAt,
    );
  },
};

export const healthChecks: types.IModHealthCheck[] = [
  modHasFilesCheck,
  contentXmlCustomFileNameCheck,
  modShapeRecognisedCheck,
];
