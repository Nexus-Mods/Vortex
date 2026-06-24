import * as path from "path";

import * as _ from "lodash";
import minimatch from "minimatch";
import * as semver from "semver";

import { truthy } from "../../../util/util";
import type { IDownload } from "../../download_management/types/IDownload";
import type {
  IChoiceType,
  IMod,
  IModInstallSpec,
  IModReference,
  IModRule,
  IFileListItem,
  IModAttributes,
  IModPatches,
} from "../types/IMod";
import { coerceToSemver, safeCoerce } from "./coerceToSemver";
import { isFuzzyVersion } from "./isFuzzyVersion";

export interface IModLookupInfo {
  id?: string;
  fileMD5: string;
  fileSizeBytes: number;
  fileName: string;
  name?: string;
  logicalFileName?: string;
  additionalLogicalFileNames?: string[];
  customFileName?: string;
  version: string;
  game?: string[];
  fileId?: string;
  modId?: string;
  source?: string;
  referenceTag?: string;
  installerChoices?: IChoiceType;
  patches?: IModPatches;
  fileList?: IFileListItem[];
}

export function modAttributesToLookupInfo(
  mod: IMod | IModAttributes | IModLookupInfo,
): IModLookupInfo {
  const gameAttrib = (mod as IModAttributes).game;
  if (gameAttrib && Array.isArray(gameAttrib) && gameAttrib.length > 0) {
    return mod as IModLookupInfo;
  }
  const attrs: IModAttributes = (mod as IMod).attributes ?? (mod as IModAttributes);
  return {
    id: (mod as IMod).id,
    fileMD5: attrs.fileMD5,
    fileSizeBytes: attrs.fileSize ?? 0,
    fileName: attrs.fileName ?? attrs.modName ?? attrs.name,
    name: attrs.modName ?? attrs.name,
    logicalFileName: attrs.logicalFileName,
    additionalLogicalFileNames: attrs.additionalLogicalFileNames,
    customFileName: attrs.customFileName,
    version: attrs.version ?? attrs.modVersion ?? "",
    game: attrs.game,
    fileId: attrs.fileId?.toString(),
    modId: attrs.modId?.toString(),
    source: attrs.source,
    referenceTag: attrs.referenceTag,
    installerChoices: attrs.installerChoices,
    patches: attrs.patches,
    fileList: attrs.fileList,
  };
}

// test if the reference is by id only, meaning it is only useful in the current setup
export function idOnlyRef(ref: IModReference) {
  return (
    ref?.id !== undefined &&
    Object.keys(_.omit(ref, ["archiveId", "versionMatch", "idHint"])).length === 1
  );
}

// these are only the "important" fields of the reference, not the "helper" fields
const REFERENCE_FIELDS = [
  "fileMD5",
  "logicalFileName",
  "fileExpression",
  "versionMatch",
  "repo",
  "tag",
];
export function referenceEqual(lhs: IModReference, rhs: IModReference): boolean {
  // the id is only used if it's the only matching field (apart from the archive id)
  if (idOnlyRef(lhs) || idOnlyRef(rhs)) {
    return lhs.id === rhs.id;
  }
  return _.isEqual(_.pick(lhs, REFERENCE_FIELDS), _.pick(rhs, REFERENCE_FIELDS));
}

/**
 * Check whether an installed mod matches a requested install spec: the same installer
 * choices, file list, and binary patches. This is deliberately separate from
 * testModReference / findModByRef, which match a mod by IDENTITY only (which mod,
 * not how it was installed). Identity matching answers "is this mod installed";
 * install-spec matching answers "was it installed the way this rule asks for".
 *
 * Matching is purely by CONTENT (the choices / file list / patch data) and does not
 * use the reference tag: tags are shortid-generated and are neither stable nor
 * guaranteed unique, so a tag comparison cannot reliably distinguish installs.
 */
export function modMatchesInstallSpec(mod: IMod | IModLookupInfo, spec: IModInstallSpec): boolean {
  const lookup = (mod as IMod).attributes
    ? modAttributesToLookupInfo(mod)
    : (mod as IModLookupInfo);

  if (
    spec.installerChoices != null &&
    Object.keys(spec.installerChoices).length > 0 &&
    !_.isEqualWith(lookup.installerChoices, spec.installerChoices)
  ) {
    return false;
  }

  if (
    spec.fileList != null &&
    spec.fileList.length > 0 &&
    !_.isEqual(spec.fileList, lookup.fileList)
  ) {
    return false;
  }

  if (
    spec.patches != null &&
    Object.keys(spec.patches).length > 0 &&
    !_.isEqual(lookup.patches, spec.patches)
  ) {
    return false;
  }

  return true;
}

/**
 * The install spec (installer choices / file list / patches) a collection rule asks
 * for. This is the single place that reads a rule's install-spec fields, so the
 * legacy-location fallback for `patches` lives only here.
 */
export function ruleInstallSpec(rule: IModRule): IModInstallSpec {
  return {
    installerChoices: rule.installerChoices,
    fileList: rule.fileList,
    // `patches` is now a first-class IModRule field; fall back to the old
    // `rule.extra.patches` location so collection rules persisted before that move
    // still match without a migration.
    patches: rule.patches ?? rule.extra?.["patches"],
  };
}

/**
 * The install-ordering phase a rule belongs to. `phase` is a first-class IModRule
 * field, but older rules stored it under `extra.phase`; this is the single place that
 * bridges the two locations (mirroring ruleInstallSpec for patches), so callers never
 * have to know about the legacy location. Defaults to phase 0.
 */
export function rulePhase(rule: IModRule | undefined): number {
  return rule?.phase ?? (rule?.extra?.["phase"] as number | undefined) ?? 0;
}

/**
 * Converts an IDownload object to an IModReference object.
 * Extracts relevant metadata from the download's modInfo structure to populate
 * the reference fields used for mod matching and dependency resolution.
 *
 * @param download - The download object to convert
 * @returns IModReference object with populated fields from the download
 */
export function downloadToModRef(download: IDownload): IModReference {
  // Extract modId and fileId from nested structures
  // Priority: nexus.ids (preferred) -> meta.details (fallback)
  const modId =
    download.modInfo?.nexus?.ids?.modId?.toString() ?? download.modInfo?.meta?.details?.modId;
  const fileId =
    download.modInfo?.nexus?.ids?.fileId?.toString() ?? download.modInfo?.meta?.details?.fileId;

  const ref: IModReference = {
    archiveId: download.id,
    repo: download.modInfo?.source
      ? {
          repository: download.modInfo.source,
          modId: modId,
          fileId: fileId,
        }
      : undefined,
    fileMD5: download.fileMD5,
    gameId: download.game?.[0],
    logicalFileName: download.modInfo?.meta?.logicalFileName ?? download.localPath,
  };
  return ref;
}

export function sanitizeExpression(fileName: string): string {
  // Validate input - return empty string for invalid inputs
  if (fileName == null || typeof fileName !== "string") {
    return "";
  }

  // drop extension and anything like ".1" or " (1)" at the end which probaby
  // indicates duplicate downloads (either in our own format or common browser
  // style)
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/\.\d+$/, "")
    .replace(/ \(\d+\)$/, "");
}

function hasIdentifyingMarker(
  mod: IModLookupInfo,
  modId: string,
  ref: IModReference,
  fuzzyVersion: boolean,
  allowTag: boolean,
): boolean {
  return (
    (ref.id !== undefined && modId !== undefined) ||
    (!fuzzyVersion && ref.fileMD5 !== undefined && mod.fileMD5 !== undefined) ||
    (ref.fileExpression !== undefined && (mod.fileName ?? mod.name) !== undefined) ||
    (ref.logicalFileName !== undefined && mod.logicalFileName !== undefined) ||
    (ref.repo !== undefined && mod.source !== undefined) ||
    (allowTag && ref.tag !== undefined && mod.referenceTag !== undefined)
  );
}

let onRefResolved: (
  gameId: string,
  modId: string,
  reference: IModReference,
  refModId: string,
) => void;

function testRef(
  mod: IModLookupInfo,
  modId: string,
  ref: IModReference,
  source?: { gameId: string; modId: string },
  fuzzyVersion?: boolean,
): boolean {
  // A reference identifies WHICH mod is wanted, not how it was installed. Installer
  // choices, file list and patches (the install spec) are matched separately via
  // modMatchesInstallSpec / ruleInstallSpec, so a correctly-installed mod is still
  // recognised here even if it was installed with a different spec.

  // Additional safety checks for ref parameter
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) {
    return false;
  }

  // if an id is set, it has to match
  if (ref.id != null && (modId != null || idOnlyRef(ref)) && ref.id !== modId) {
    return false;
  }

  // testing if a version is fuzzy can be quite expensive. When doing multiple comparisons
  // for the same reference, the caller can calculate it once and pass it in
  if (fuzzyVersion == null) {
    fuzzyVersion = isFuzzyVersion(ref.versionMatch);
  }

  if (!hasIdentifyingMarker(mod, modId, ref, fuzzyVersion, true)) {
    // if the reference doesn't have any marker that _could_ match this mod,
    // return !false!, otherwise we might match any random mod that also has no matching marker
    return false;
  }

  if (ref.tag != null) {
    if (mod.referenceTag === ref.tag) {
      return true;
    } else {
      // tags differ. if the mod has no stricter attribute we have to refuse here, otherwise
      // we'd match any kind of crap.
      if (!hasIdentifyingMarker(mod, modId, ref, fuzzyVersion, false)) {
        return false;
      }
    }
  }

  // if reference is by file hash and the match is not fuzzy, require the md5 to match
  if (truthy(ref.fileMD5) && !fuzzyVersion && mod.fileMD5 !== ref.fileMD5) {
    return false;
  }

  if (ref.repo != null) {
    if (ref.repo.repository !== mod.source || ref.repo.modId !== (mod.modId || -1).toString()) {
      return false;
    }

    if (!fuzzyVersion) {
      // we already know it's the same repo and modId, if it's also the same
      // file id this is definitively the same file
      return ref.repo.fileId === (mod.fileId || -1).toString();
    }
  } else {
    if (!!ref.fileMD5 && ref.fileMD5 === mod.fileMD5) {
      // We don't have repo info which means that this is an external reference.
      //  A matching MD5 identifies the file - this is good enough.
      return true;
    }
  }

  // right file?
  if (ref.logicalFileName != null) {
    if (mod.additionalLogicalFileNames != null) {
      if (
        !mod.additionalLogicalFileNames.includes(ref.logicalFileName) &&
        ![mod.logicalFileName, mod.customFileName].includes(ref.logicalFileName) &&
        ref.fileExpression == null
      ) {
        return false;
      }
    } else if (
      ![mod.logicalFileName, mod.customFileName].includes(ref.logicalFileName) &&
      ref.fileExpression == null
    ) {
      return false;
    }
  }

  if (ref.fileExpression != null) {
    // file expression is either an exact match against the mod name or
    // a glob match against the archive name (without file extension)
    if (mod.fileName == null) {
      if (mod.name !== ref.fileExpression) {
        return false;
      }
    } else {
      const baseName = sanitizeExpression(mod.fileName);
      if (baseName !== ref.fileExpression && !minimatch(baseName, ref.fileExpression)) {
        return false;
      }
    }
  }

  // right version?
  if (truthy(ref.versionMatch) && ref.versionMatch !== "*" && truthy(mod.version)) {
    const versionMatch = ref.versionMatch.split("+")[0];
    const doesMatch =
      mod.version === ref.versionMatch ||
      ref.fileMD5 === mod.fileMD5 ||
      safeCoerce(mod.version) === safeCoerce(versionMatch);
    if (!doesMatch) {
      const versionCoerced = coerceToSemver(mod.version);
      if (semver.valid(versionCoerced)) {
        if (
          !semver.satisfies(versionCoerced, versionMatch, {
            loose: true,
            includePrerelease: true,
          })
        ) {
          return false;
        } // the version is a valid semantic version and does match
      } else {
        // if the version number can't be interpreted then we can only use the exact match
        return false;
      }
    }
  }

  // right game?
  if (ref.gameId !== undefined && mod.game !== undefined && mod.game.indexOf(ref.gameId) === -1) {
    return false;
  }

  if (source !== undefined && modId !== undefined && ref.idHint !== modId) {
    // if this resolved to a different mod
    onRefResolved?.(source.gameId, source.modId, ref, modId);
  }

  return true;
}

/**
 * The loose Nexus identifiers a reference can be matched against (a mod page + file ids/names),
 * plus an optional caller-supplied fallback predicate. Shared so callers do not re-declare the
 * shape inline.
 */
export interface IReferenceIdentifiers {
  gameId: string;
  modId?: number;
  fileId?: number;
  fileNames?: string[];
  fileIds?: string[];
  condition?: () => boolean;
}

export function testRefByIdentifiers(
  identifiers: IReferenceIdentifiers,
  ref: IModReference,
): boolean {
  if (identifiers == null || typeof identifiers !== "object" || Array.isArray(identifiers)) {
    return false;
  }

  const { fileNames, modId, fileIds, condition } = identifiers;
  if (ref.repo?.modId != null && modId != null) {
    // Definitive match: same mod page and same file
    if (
      ref.repo.modId === modId.toString() &&
      ref.repo?.fileId != null &&
      fileIds != null &&
      fileIds.length > 0 &&
      fileIds.includes(ref.repo.fileId)
    ) {
      return true;
    }
    if (!isNaN(modId)) {
      if (ref.repo.modId !== modId.toString()) {
        // Different mod page — don't fall through to weaker matching criteria
        // like logicalFileName which can produce false matches for generic names
        return false;
      }
      // Same mod page but different file (e.g. different version) — the fileId
      // mismatch is definitive (we already checked for a match above)
      if (ref.repo?.fileId != null && fileIds != null && fileIds.length > 0) {
        return false;
      }
    }
  }
  // right file?
  if (ref.fileExpression == null && ref.logicalFileName != null && fileNames != null) {
    if (fileNames.includes(ref.logicalFileName)) {
      return true;
    }
  }

  if (ref.fileExpression != null && fileNames != null) {
    // file expression is either an exact match against the mod name or
    // a glob match against the archive name (without file extension)
    for (const fileName of fileNames) {
      const baseName = sanitizeExpression(fileName);
      if (baseName === ref.fileExpression || minimatch(baseName, ref.fileExpression)) {
        return true;
      }
    }
  }

  if (condition?.()) {
    return true;
  }

  return false;
}

/**
 * sets the callback for when a (fuzzy) mod reference is resolved, so the cache can be updated
 */
export function setResolvedCB(
  cb: (gameId: string, sourceModId: string, ref: IModReference, modId: string) => void,
) {
  onRefResolved = cb;
}

export function testModReference(
  mod: IMod | IModLookupInfo,
  reference: IModReference,
  source?: { gameId: string; modId: string },
  fuzzyVersion?: boolean,
) {
  if (mod == null || typeof mod !== "object" || Array.isArray(mod)) {
    return false;
  }

  if (reference == null || typeof reference !== "object" || Array.isArray(reference)) {
    return false;
  }

  if ((mod as IMod).attributes) {
    return testRef(modAttributesToLookupInfo(mod), mod.id, reference, source, fuzzyVersion);
  } else {
    const lookup = mod as IModLookupInfo;
    return testRef(lookup, lookup.id, reference, source, fuzzyVersion);
  }
}

/**
 * A "dependency" rule pulls a member into a collection - requires (mandatory) or recommends
 * (optional). The other rule types (before/after/conflicts) only express ordering or conflicts and
 * never add a mod. Centralises the `["requires", "recommends"].includes(rule.type)` check that is
 * otherwise repeated throughout the collection code.
 */
export function isDependencyRule(rule: IModRule): boolean {
  return rule.type === "requires" || rule.type === "recommends";
}

/**
 * Find the rule whose reference matches a mod - the inverse of findModByRef (which finds a mod by a
 * reference). Answers "which of these rules applies to / pulled in this mod"; pass a mod's or a
 * collection's `rules`.
 *
 * The mod is converted to lookup info once, up front, rather than letting testModReference rebuild
 * it for every rule in the scan (the same "hoist the constant per-scan work" idea findModByRef uses
 * for its reference). The per-rule tag/md5/id fast-paths already live inside testRef, so there is
 * nothing to add here for those.
 */
export function findRuleByRef(rules: IModRule[] | undefined, mod: IMod): IModRule | undefined {
  if (!Array.isArray(rules)) {
    return undefined;
  }
  const lookup = modAttributesToLookupInfo(mod);
  return rules.find((rule) => testModReference(lookup, rule.reference));
}

export default testModReference;
