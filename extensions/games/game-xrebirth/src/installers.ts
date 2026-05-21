import path from "path";

import { fs, util } from "@nexusmods/vortex-api";
import type { types } from "@nexusmods/vortex-api";
import { parseStringPromise } from "xml2js";

export const XREBIRTH_GAME_ID = "xrebirth";

/**
 * Single source of truth for modType IDs registered by this extension. Mirrored
 * by the installer ids in the spec table below so deployment can route on
 * modType without string drift.
 */
export const XREBIRTH_MOD_TYPES = {
  savegame: "xrebirth-savegame",
  shaderInjector: "xrebirth-shader-injector",
  utility: "xrebirth-utility",
  dropIn: "xrebirth-dropin",
  savePatch: "xrebirth-save-patch",
  documentation: "xrebirth-documentation",
} as const;

/**
 * Installer priority slots. Vortex dispatches lower numbers first, so the
 * most specific match must have the lowest number. The ordering rationale:
 *
 *   contentXml (50)    — canonical X Rebirth mod shape; XML-driven and
 *                        emits attribute instructions. Always tried first.
 *   savegame (60)      — narrow regex (save_NNN.xml / quicksave.xml) that
 *                        wouldn't accidentally swallow other XML mods.
 *   shaderInjector(65) — d3d9/dxgi/SweetFX/ReShade markers; specific enough
 *                        to beat the generic .exe utility match.
 *   utility (70)       — .exe presence; broad, but more specific than the
 *                        stopPattern drop-in fallback.
 *   dropIn (75)        — game-shape match via the registered stopPatterns;
 *                        covers everything that "looks like an X Rebirth
 *                        drop-in" without an .exe or shader marker.
 *   savePatch (80)     — runs after dropIn because XML/TXT-only archives
 *                        that ALSO match a stop-pattern (rare but possible)
 *                        should deploy as a drop-in instead.
 *   documentation (90) — pure-docs catch-all; only fires when no installer
 *                        above accepts the archive.
 */
const PRIORITIES = {
  contentXml: 50,
  savegame: 60,
  shaderInjector: 65,
  utility: 70,
  dropIn: 75,
  savePatch: 80,
  documentation: 90,
} as const;

/** SweetFX / ReShade shader-injector signatures. */
const SHADER_MARKERS = [
  /(^|\/)d3d9\.dll$/i,
  /(^|\/)dxgi\.dll$/i,
  /(^|\/)d3d9\.ini$/i,
  /(^|\/)SweetFX([\\/]|_)/i,
  /(^|\/)reshade-shaders\//i,
  /(^|\/)ReShade\//i,
];

/** Matches `save_NNN.xml` and `quicksave.xml` filenames at any depth. */
const SAVE_FILE_RE = /(^|\/)(quicksave|save_\d+)\.xml$/i;

const DOC_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".xlsx",
  ".xls",
  ".docx",
  ".doc",
  ".odt",
  ".ods",
  ".md",
  ".rtf",
];

/**
 * Declarative installer table for X Rebirth. Priority ordering is documented
 * on the PRIORITIES constant above.
 */
export const XREBIRTH_INSTALLER_SPECS: types.IInstallerSpec[] = [
  {
    id: "savegame",
    priority: PRIORITIES.savegame,
    modType: XREBIRTH_MOD_TYPES.savegame,
    match: { kind: "regex", patterns: [SAVE_FILE_RE], mode: "any" },
    install: { stripCommonRoot: false },
  },
  {
    id: "shader-injector",
    priority: PRIORITIES.shaderInjector,
    modType: XREBIRTH_MOD_TYPES.shaderInjector,
    match: { kind: "regex", patterns: SHADER_MARKERS, mode: "any" },
    install: { stripCommonRoot: true },
  },
  {
    id: "utility",
    priority: PRIORITIES.utility,
    modType: XREBIRTH_MOD_TYPES.utility,
    match: { kind: "extensions", list: [".exe"], mode: "any" },
    install: { stripCommonRoot: true },
  },
  {
    id: "dropin",
    priority: PRIORITIES.dropIn,
    modType: XREBIRTH_MOD_TYPES.dropIn,
    // Files match one of the game's `details.stopPatterns` — translations under
    // `t/`, `.cat`/`.dat` archives, voice packs, etc.
    match: { kind: "stopPatterns" },
    install: { stripCommonRoot: true },
  },
  {
    id: "save-patch",
    priority: PRIORITIES.savePatch,
    modType: XREBIRTH_MOD_TYPES.savePatch,
    // Every file is .xml or .txt and at least one is .xml. Custom predicate
    // because the "all of these AND at least one of those" shape doesn't fit
    // the simpler match kinds.
    match: {
      kind: "custom",
      predicate: (files: string[]): boolean => {
        const data = files.filter((f) => !f.endsWith(path.sep));
        return (
          data.length > 0 &&
          data.every((f) => /\.(xml|txt)$/i.test(f)) &&
          data.some((f) => /\.xml$/i.test(f))
        );
      },
    },
    install: { stripCommonRoot: false },
  },
  {
    id: "documentation",
    priority: PRIORITIES.documentation,
    modType: XREBIRTH_MOD_TYPES.documentation,
    match: { kind: "extensions", list: DOC_EXTENSIONS, mode: "all" },
    install: { stripCommonRoot: true },
  },
];

/**
 * `testSupported` for the canonical content.xml installer. Parses the XML at
 * install time, so it stays hand-written rather than going through the
 * declarative spec table.
 */
export function testContentXml(files: string[], gameId: string): Promise<types.ISupportedResult> {
  if (gameId !== XREBIRTH_GAME_ID) {
    return Promise.resolve({ supported: false, requiredFiles: [] });
  }
  const contentPath = files.find((file) => path.basename(file) === "content.xml");
  return Promise.resolve({
    supported: contentPath !== undefined,
    requiredFiles: contentPath !== undefined ? [contentPath] : [],
  });
}

export async function installContentXml(
  files: string[],
  destinationPath: string,
): Promise<types.IInstallResult> {
  const contentPath = files.find((file) => path.basename(file) === "content.xml")!;
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

/** Registration priority of the content.xml installer. */
export const XREBIRTH_CONTENT_XML_PRIORITY = PRIORITIES.contentXml;
