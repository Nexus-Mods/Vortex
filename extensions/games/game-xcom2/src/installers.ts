import * as path from "node:path";

import type { types } from "vortex-api";

/**
 * Internal Vortex game ids registered by this extension. WOTC uses
 * `nexusPageId: "xcom2"` so a single Nexus domain feeds both ids.
 */
export const XCOM2_GAME_IDS = {
  base: "xcom2",
  wotc: "xcom2-wotc",
} as const;

/** Mod-type ids registered by this extension. */
export const XCOM2_MOD_TYPES = {
  characterPool: "xcom2-character-pool",
  configDropIn: "xcom2-config-drop-in",
} as const;

/** Baseline mod-descriptor extension used by the canonical XCOM 2 installer. */
const XCOM_MOD_DESCRIPTOR_EXT = ".xcommod";

/**
 * Extensions that the config/loc drop-in installer recognises. `.int`, `.rus`,
 * `.deu` (etc.) are language-tagged localisation tables; `.ini` is config.
 */
const CONFIG_DROP_IN_RE = /\.(ini|int|rus|deu|esn|fra|ita|kor|pol|chn|cht|jpn)$/i;

/**
 * Priority slots. Vortex dispatches lower numbers first; the most specific
 * match needs the lowest priority. Reasoning:
 *
 *   xcomMod (25)        — canonical XCOM 2 mod shape (archive contains a
 *                         `.XComMod` descriptor). Always tried first. Lives
 *                         in `index.ts` as the hand-written installer.
 *   characterPool (30)  — `.bin` files with no `.XComMod` present; routed to
 *                         the in-game importable folder via the
 *                         `xcom2-character-pool` modType.
 *   configDropIn (40)   — bare `.ini` / `.int` archives with no `.XComMod`;
 *                         routed into `XComGame/Config/` and
 *                         `XComGame/Localization/` via the
 *                         `xcom2-config-drop-in` modType. Runs after
 *                         character pools because a translation pack happens
 *                         to also have a `.bin` is vanishingly rare and
 *                         character-pool routing is the better default.
 */
const PRIORITIES = {
  characterPool: 30,
  configDropIn: 40,
} as const;

export const XCOM2_CONFIG_DROP_IN_PRIORITY = PRIORITIES.configDropIn;

/**
 * Per-file regex for the XCOM 2 character-pool descriptor. Used by `match`
 * (any file is `.bin` AND no file is `.XComMod`) and by the install-time
 * `filter` (only `.bin` survives the copy).
 */
const BIN_EXTENSION = ".bin";
const XCOM_MOD_DESCRIPTOR = ".XComMod";

/**
 * Declarative installer table for XCOM 2. Currently a single spec — character
 * pools — registered after the canonical `.XComMod` installer so the latter
 * still wins on legitimate XCOM 2 mod archives.
 */
export const XCOM2_INSTALLER_SPECS: types.IInstallerSpec[] = [
  {
    id: "character-pool",
    priority: PRIORITIES.characterPool,
    modType: XCOM2_MOD_TYPES.characterPool,
    // Accept the archive when it contains at least one .bin file and no
    // .XComMod descriptor (the latter belongs to the canonical installer).
    match: {
      kind: "custom",
      predicate: (files: string[]): boolean => {
        const hasBin = files.some((f) => f.toLowerCase().endsWith(BIN_EXTENSION));
        const hasXComMod = files.some((f) =>
          f.toLowerCase().endsWith(XCOM_MOD_DESCRIPTOR.toLowerCase()),
        );
        return hasBin && !hasXComMod;
      },
    },
    // Character pool archives often bundle readmes and screenshots. The
    // in-game importer reads `.bin` files non-recursively from
    // `XComGame/CharacterPool/Importable/`, so we keep only `.bin` and
    // flatten to basenames. Subdirectory structure and companion files have
    // nowhere meaningful to live in `Importable/`.
    install: {
      stripCommonRoot: false,
      filter: { kind: "extensions", list: [BIN_EXTENSION] },
      flatten: true,
    },
  },
];

// ── config / localization drop-in installer ─────────────────────────────────
//
// Hand-written rather than declarative because the destination depends on the
// source path's *content* (look for `XComGame/` or
// `XCom2-WarOfTheChosen/XComGame/` markers and preserve the suffix from
// there) and on the active gameId (WOTC installs prepend the WOTC base dir
// when an archive uses unprefixed paths). Neither shape fits the declarative
// `match` / `filter` / `flatten` primitives.
//
// The installer claims any archive that contains at least one
// `.ini`/`.int`/lang-tagged-loc file and no `.XComMod` descriptor, then emits
// one `copy` per matching file with the destination chosen by
// `pickConfigDestination` below. Everything else (readmes, screenshots,
// wrapper directories) is dropped from the install output.

const WOTC_DIR = "XCom2-WarOfTheChosen";
const GAME_DIR = "XComGame";
// Marker patterns. Anchor at `^` or `/` so a substring like "MyXComGame" can't
// accidentally start the capture. JS regex's first-match semantics give us the
// SHALLOWEST occurrence, which is what we want — archive authors don't nest
// XComGame/ inside XComGame/.
const WOTC_TREE_RE = new RegExp(`(?:^|/)(${WOTC_DIR}/${GAME_DIR}/.+)$`, "i");
const VANILLA_TREE_RE = new RegExp(`(?:^|/)(${GAME_DIR}/.+)$`, "i");

/**
 * Choose the deploy destination for one config/loc file.
 *
 *   1. Path explicitly contains `.../XCom2-WarOfTheChosen/XComGame/...` →
 *      destination is the captured suffix. Deploys correctly under WOTC's
 *      subtree regardless of which game the user is installing for.
 *   2. Path explicitly contains `.../XComGame/...` (without the WOTC prefix)
 *      → destination is the captured `XComGame/...` suffix. For WOTC installs
 *      it's then prepended with `XCom2-WarOfTheChosen/` so the file lands in
 *      the WOTC tree, not vanilla.
 *   3. Bare file with no recognisable tree marker → route by extension:
 *      `.ini` → `XComGame/Config/<basename>`,
 *      `.int`/other loc → `XComGame/Localization/<basename>`.
 *      For WOTC installs, prepend `XCom2-WarOfTheChosen/` to the fallback.
 */
export function pickConfigDestination(file: string, gameId: string): string {
  const norm = file.replace(/\\/g, "/");

  const wotc = norm.match(WOTC_TREE_RE);
  if (wotc !== null) return wotc[1]!.replace(/\//g, path.sep);

  const vanilla = norm.match(VANILLA_TREE_RE);
  if (vanilla !== null) {
    const inner = vanilla[1]!.replace(/\//g, path.sep);
    return gameId === XCOM2_GAME_IDS.wotc ? path.join(WOTC_DIR, inner) : inner;
  }

  // No tree marker — fall back to extension-based routing.
  const base = path.basename(file);
  let inner: string;
  if (/\.ini$/i.test(file)) inner = path.join(GAME_DIR, "Config", base);
  else inner = path.join(GAME_DIR, "Localization", base);

  return gameId === XCOM2_GAME_IDS.wotc ? path.join(WOTC_DIR, inner) : inner;
}

/**
 * Accepts archives that look like config / localisation drop-ins for either
 * XCOM 2 game id: at least one `.ini`/`.int`/lang-tagged-loc file, and no
 * `.XComMod` descriptor (those are claimed by the canonical installer at the
 * lower priority slot 25).
 */
export function testConfigDropIn(files: string[], gameId: string): Promise<types.ISupportedResult> {
  const isXCOM2 = gameId === XCOM2_GAME_IDS.base || gameId === XCOM2_GAME_IDS.wotc;
  if (!isXCOM2) return Promise.resolve({ supported: false, requiredFiles: [] });

  const data = files.filter((f) => !f.endsWith(path.sep) && !f.endsWith("/"));
  const hasConfig = data.some((f) => CONFIG_DROP_IN_RE.test(f));
  const hasXComMod = data.some((f) => f.toLowerCase().endsWith(XCOM_MOD_DESCRIPTOR_EXT));
  return Promise.resolve({
    supported: hasConfig && !hasXComMod,
    requiredFiles: [],
  });
}

/**
 * Emit one `copy` instruction per `.ini`/`.int` file routed through
 * `pickConfigDestination`. Non-config files (readmes, screenshots, wrappers)
 * are dropped. The `setmodtype` tag routes the resulting mod through the
 * `xcom2-config-drop-in` modType which has install path = `<gamePath>`, so
 * destination strings can use the `XCom2-WarOfTheChosen/...` prefix when the
 * file belongs in the WOTC subtree.
 */
export function installConfigDropIn(
  files: string[],
  // Unused but matches Vortex's InstallFunc signature so Vortex passes gameId
  // through; we receive it as a separate closure-bound argument from the
  // registration site in `index.ts`.
  _destinationPath?: string,
  gameId?: string,
): Promise<types.IInstallResult> {
  const resolvedGameId = gameId ?? XCOM2_GAME_IDS.base;
  const configFiles = files
    .filter((f) => !f.endsWith(path.sep) && !f.endsWith("/"))
    .filter((f) => CONFIG_DROP_IN_RE.test(f));

  const instructions: types.IInstruction[] = configFiles.map((file) => ({
    type: "copy" as const,
    source: file,
    destination: pickConfigDestination(file, resolvedGameId),
  }));
  instructions.push({ type: "setmodtype" as const, value: XCOM2_MOD_TYPES.configDropIn });
  return Promise.resolve({ instructions });
}
