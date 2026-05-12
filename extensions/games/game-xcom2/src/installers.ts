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
} as const;

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
 */
const PRIORITIES = {
  characterPool: 30,
} as const;

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
