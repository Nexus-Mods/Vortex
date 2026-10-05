import path from "path";

import { log, util } from "@nexusmods/vortex-api";
export class ResourceInaccessibleError extends Error {
  private mIsReportingAllowed;
  private mFilePath;
  constructor(filePath, allowReport = false) {
    super(`"${filePath}" is being manipulated by another process`);
    this.mFilePath = filePath;
    this.mIsReportingAllowed = allowReport;
  }

  get isOneDrive() {
    const segments = this.mFilePath
      .split(path.sep)
      .filter((seg) => !!seg)
      .map((seg) => seg.toLowerCase());
    return segments.includes("onedrive");
  }

  get allowReport() {
    return this.mIsReportingAllowed;
  }

  get errorMessage() {
    return this.isOneDrive
      ? this.message + ": " + "probably by the OneDrive service."
      : this.message + ": " + "close all applications that may be using this file.";
  }
}

export class MergeDataViolationError extends Error {
  // Merge data violation errors intends to cater for/block curators
  //  from uploading a collection with faulty merged data.
  // We define faulty merged data as:
  //  1. A merged script segment which relies on a certain mod to be included in the
  //     collection, yet it is not included.
  //  2. A merged script segment which requires a specific mod to be installed,
  //     yet the collection highlighted said mod as "optional"; potentially
  //     resulting in the mod being missing on the user end.
  private mNotIncluded: string[];
  private mOptional: string[];
  private mCollectionName: string;
  constructor(notIncluded: string[], optional: string[], collectionName: string) {
    super(
      `Merged script data for ${collectionName} is referencing missing/undeployed/optional mods`,
    );
    this.name = "MergeDataViolationError";
    this.mOptional = optional;
    this.mNotIncluded = notIncluded;
    this.mCollectionName = collectionName;
  }

  public get Optional() {
    return this.mOptional;
  }

  public get NotIncluded() {
    return this.mNotIncluded;
  }

  public get CollectionName() {
    return this.mCollectionName;
  }
}

export function getLoadOrderFilePath() {
  return path.join(util.getVortexPath("documents"), "The Witcher 3", LOAD_ORDER_FILENAME);
}

export function getDx12UserSettingsPath() {
  return path.join(util.getVortexPath("documents"), "The Witcher 3", DX12_USER_SETTINGS_FILENAME);
}

export function getRemasterNoticeSeenBranch() {
  return ["settings", "witcher3", "remasterNoticeSeen"];
}

export function getSuppressModLimitBranch() {
  return ["settings", "witcher3", "suppressModLimitPatch"];
}

export const GAME_ID = "witcher3";

// File used by some mods to define hotkey/input mapping
export const INPUT_XML_FILENAME = "input.xml";

// The original file is backed up on deployment - we will use the backup
//  during merges if it exists.
export const VORTEX_BACKUP_TAG = ".vortex_backup";

// The W3MM menu mod pattern seems to enforce a modding pattern
//  where {filename}.part.txt holds a diff of what needs to be
//  added to the original file - we're going to use this pattern as well.
export const PART_SUFFIX = ".part.txt";

export const SCRIPT_MERGER_ID = "W3ScriptMerger";
export const MERGE_INV_MANIFEST = "MergeInventory.xml";
export const LOAD_ORDER_FILENAME = "mods.settings";
export const DX12_USER_SETTINGS_FILENAME = "dx12user.settings";
export const I18N_NAMESPACE = "game-witcher3";
export const CONFIG_MATRIX_REL_PATH = path.join(
  "bin",
  "config",
  "r4game",
  "user_config_matrix",
  "pc",
);
// Defined alongside the per-edition lists so the two can't drift apart.
export { CONFIG_MATRIX_FILES } from "./edition";

// Resolved lazily: getVortexPath isn't available at module load in every
// context this file gets imported from.
export function getW3TempDataDir() {
  return path.join(util.getVortexPath("temp"), "W3TempData");
}

export const UNI_PATCH = "mod0000____CompilationTrigger";
export const LOCKED_PREFIX = "mod0000_";
export const AUTO_SORT_LABEL = "Sort load order alphabetically on every deployment";

export function isLockedEntry(modName: string) {
  if (!modName || typeof modName !== "string") {
    log("debug", "encountered invalid mod instance/name");
    return false;
  }
  return modName.startsWith(LOCKED_PREFIX);
}

export const DO_NOT_DISPLAY = ["communitypatch-base"];
// minimatch is supposed to be case-insensitive, but it's not working for some reason...
export const DO_NOT_DEPLOY = ["README.TXT", `**/*${PART_SUFFIX.toUpperCase()}`];
export const SCRIPT_MERGER_FILES = ["WitcherScriptMerger.exe"];

export const NON_SORTABLE = ["witcher3menumoddocuments", "collection"];

export const ACTIVITY_ID_IMPORTING_LOADORDER = "activity-witcher3-importing-loadorder";
