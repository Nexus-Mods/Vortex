/**
 * Imperative hooks for the X Rebirth GDL extension. The declarative parts of
 * the extension live in game.yaml; this file holds the two things GDL can't
 * express declaratively:
 *
 *   - installContentXml: the canonical content.xml installer, which parses the
 *     XML and emits attribute instructions. Referenced by game.yaml's
 *     `install: { hook: installContentXml }`.
 *   - the three in-game health checks, referenced by game.yaml's `diagnostics:`
 *     block and registered via context.registerHealthCheck.
 */
import path from "path";

import { fs, types, util } from "@nexusmods/vortex-api";
import { parseStringPromise } from "xml2js";

/** Mod type ids, mirrored from game.yaml's modTypes block. */
const XREBIRTH_MOD_TYPES = {
  savegame: "xrebirth-savegame",
  shaderInjector: "xrebirth-shader-injector",
  utility: "xrebirth-utility",
  dropIn: "xrebirth-dropin",
  savePatch: "xrebirth-save-patch",
  documentation: "xrebirth-documentation",
} as const;

// ---------------------------------------------------------------------------
// content.xml installer
// ---------------------------------------------------------------------------

/**
 * Custom install hook for the canonical content.xml mod shape. Parses the XML
 * at install time and emits attribute instructions (customFileName, etc.) plus
 * copy instructions, deploying the mod under `extensions/<content-id>`.
 *
 * GDL gates support via the `when: { hasFile: "**\/content.xml" }` predicate, so
 * this only runs when a content.xml is present.
 */
export async function installContentXml(
  files: string[],
  destinationPath: string,
): Promise<types.IInstallResult> {
  // Match case-insensitively to agree with the `hasFile: "**/content.xml"`
  // predicate that gates this installer (GDL globs are case-insensitive); a
  // case-sensitive lookup here would miss e.g. `Content.XML` and crash.
  const contentPath = files.find((file) => path.basename(file).toLowerCase() === "content.xml")!;
  const basePath = path.dirname(contentPath);

  const data = await fs.readFileAsync(path.join(destinationPath, contentPath), {
    encoding: "utf8",
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = await parseStringPromise(data);
  } catch (err) {
    throw new util.DataInvalid("content.xml invalid: " + err.message);
  }

  const attrs = (parsed?.content as Record<string, unknown>)?.$ as
    | Record<string, string>
    | undefined;

  const outputPath = attrs?.id;
  if (outputPath === undefined) {
    throw new util.DataInvalid("invalid or unsupported content.xml");
  }

  const attrInstructions: types.IInstruction[] = Object.entries({
    customFileName: attrs?.name?.trim(),
    description: attrs?.description,
    sticky: attrs?.save === "true",
    author: attrs?.author,
    version: attrs?.version,
  }).map(([key, value]) => ({ type: "attribute" as const, key, value }));

  // Archive entries may arrive with `/` or `\` separators depending on the
  // extraction backend; accept either when matching the wrapping dir.
  const isDir = (f: string): boolean => f.endsWith("/") || f.endsWith("\\");
  const isUnderBase = (f: string): boolean => {
    if (!f.startsWith(basePath)) return false;
    const sep = f.charAt(basePath.length);
    return sep === "/" || sep === "\\";
  };
  const copyInstructions: types.IInstruction[] = files
    .filter((file) => isUnderBase(file) && !isDir(file))
    .map((file) => ({
      type: "copy" as const,
      source: file,
      destination: path.join(outputPath, file.substring(basePath.length + 1)),
    }));

  return { instructions: attrInstructions.concat(copyInstructions) };
}

// ---------------------------------------------------------------------------
// health checks
// ---------------------------------------------------------------------------

// Every mod our installers produce is tagged with one of these modTypes (the
// content.xml installer is the exception and is recognised separately). The
// mod-shape health check uses this set to confirm an installed mod has a
// recognised X Rebirth shape.
const RECOGNISED_MOD_TYPES = new Set<string>(Object.values(XREBIRTH_MOD_TYPES));

const CATEGORY = types.HealthCheckCategory.Mods;
const TRIGGERS: types.HealthCheckTrigger[] = [
  types.HealthCheckTrigger.ModsChanged,
  types.HealthCheckTrigger.Manual,
];
const SEVERITY_INFO = types.HealthCheckSeverity.Info;
const SEVERITY_WARNING = types.HealthCheckSeverity.Warning;

function isContentXmlMod(mod: types.IModCheckContext): boolean {
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
 * Fails when an install produced zero files - typically means the installer's
 * filter logic ate every entry (e.g. directory-only filter mis-applied).
 */
export const modHasFilesCheck: types.IModHealthCheck = {
  id: "xrebirth-mod-has-files",
  name: "X Rebirth - mod has files",
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
export const contentXmlCustomFileNameCheck: types.IModHealthCheck = {
  id: "xrebirth-content-xml-customFileName",
  name: "X Rebirth - content.xml carries customFileName",
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
 * mod, or one tagged with a known modType (savegame, drop-in, utility, shader,
 * etc.). Otherwise the installer matched something that isn't X Rebirth content.
 */
export const modShapeRecognisedCheck: types.IModHealthCheck = {
  id: "xrebirth-mod-shape-recognised",
  name: "X Rebirth - mod has a recognisable shape",
  description:
    "Verifies the install output is a content.xml mod or is tagged with a known modType.",
  category: CATEGORY,
  severity: SEVERITY_WARNING,
  triggers: TRIGGERS,
  checkMod: async (_api, mod) => {
    const startedAt = Date.now();
    if (isContentXmlMod(mod)) {
      return passed("xrebirth-mod-shape-recognised", "Recognised as content.xml mod", startedAt);
    }
    const modType = mod.attributes.modType as string | undefined;
    if (modType !== undefined && RECOGNISED_MOD_TYPES.has(modType)) {
      return passed(
        "xrebirth-mod-shape-recognised",
        `Recognised by modType: ${modType}`,
        startedAt,
      );
    }
    return warning(
      "xrebirth-mod-shape-recognised",
      "Install output has no recognisable X Rebirth shape",
      "No content.xml and no recognised modType.",
      startedAt,
    );
  },
};
