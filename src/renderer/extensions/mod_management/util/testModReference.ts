import { truthy } from "../../../util/util";

import type {
  IMod,
  IModReference,
  IFileListItem,
  IModAttributes,
} from "../types/IMod";
import type { IDownload } from "../../download_management/types/IDownload";

import * as _ from "lodash";
import minimatch from "minimatch";
import * as path from "path";
import * as semver from "semver";

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
  installerChoices?: any;
  patches?: any;
  fileList?: IFileListItem[];
}

export function modAttributesToLookupInfo(
  mod: IMod | IModAttributes | IModLookupInfo,
): IModLookupInfo {
  const gameAttrib = (mod as IModAttributes).game;
  if (gameAttrib && Array.isArray(gameAttrib) && gameAttrib.length > 0) {
    return mod as IModLookupInfo;
  }
  const attrs: IModAttributes =
    (mod as IMod).attributes ?? (mod as IModAttributes);
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
    Object.keys(_.omit(ref, ["archiveId", "versionMatch", "idHint"])).length ===
      1
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
export function referenceEqual(
  lhs: IModReference,
  rhs: IModReference,
): boolean {
  // the id is only used if it's the only matching field (apart from the archive id)
  if (idOnlyRef(lhs) || idOnlyRef(rhs)) {
    return lhs.id === rhs.id;
  }
  return _.isEqual(
    _.pick(lhs, REFERENCE_FIELDS),
    _.pick(rhs, REFERENCE_FIELDS),
  );
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
    download.modInfo?.nexus?.ids?.modId?.toString() ??
    download.modInfo?.meta?.details?.modId;
  const fileId =
    download.modInfo?.nexus?.ids?.fileId?.toString() ??
    download.modInfo?.meta?.details?.fileId;

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
    logicalFileName:
      download.modInfo?.meta?.logicalFileName ?? download.localPath,
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

const fuzzyVersionCache: { [input: string]: boolean } = {};

const coerceableRE = /^v?[0-9.]+$/;

export function safeCoerce(input: string): string {
  return coerceableRE.test(input) ? (coerceToSemver(input) ?? input) : input;
}

export function coerceToSemver(version: string): string {
  version = version?.trim?.();
  if (!version) {
    return undefined;
  }
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (match) {
    const major = match[1];
    const minor = match[2];
    const patch = match[3];
    let preRelease = match[4].trim();

    // If there's something after the first three segments, treat it as pre-release
    if (preRelease) {
      // Remove leading punctuation from the pre-release part
      preRelease = preRelease.replace(/^[\.\-\+]/, "");
      return `${major}.${minor}.${patch}-${preRelease}`;
    } else {
      return `${major}.${minor}.${patch}`;
    }
  } else {
    if (coerceableRE.test(version)) {
      // Remove leading 0's from the version segments as that's
      //  an illegal semantic versioning format/pattern
      const sanitizedVersion = version.replace(/\b0+(\d)/g, "$1");
      const coerced = semver.coerce(sanitizedVersion);
      if (coerced) {
        return coerced.version;
      }
      return version;
    }
  }
}

export function isFuzzyVersion(input: string) {
  const cachedRes: boolean = fuzzyVersionCache[input];
  if (cachedRes !== undefined) {
    return cachedRes;
  }

  if (!truthy(input) || typeof input !== "string") {
    fuzzyVersionCache[input] = false;
  } else if (input.endsWith("+prefer") || input === "*") {
    // +prefer can be used with non-semver versions as well
    fuzzyVersionCache[input] = true;
  } else {
    // semver.validRange accepts partial versions as ranges, e.g. "1.5" is equivalent
    // to "1.5.x" but we can't accept that because then we can't distinguish them from
    // non-semantic versions where 1.5 should match exactly 1.5
    const coerced = safeCoerce(input);

    const valRange = semver.validRange(coerced);

    fuzzyVersionCache[input] = valRange !== null && valRange !== coerced;
  }

  return fuzzyVersionCache[input];
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
    (ref.fileExpression !== undefined &&
      (mod.fileName ?? mod.name) !== undefined) ||
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

  // Right installer choices?
  if (
    ref.installerChoices != null &&
    Object.keys(ref.installerChoices).length > 0 &&
    !_.isEqualWith(mod.installerChoices, ref.installerChoices)
  ) {
    return false;
  }

  // Right hashes?
  if (
    ref.fileList != null &&
    ref.fileList.length > 0 &&
    !_.isEqual(ref.fileList, mod.fileList)
  ) {
    return false;
  }

  // Right patches?
  const refHasPatches =
    ref.patches != null && Object.keys(ref.patches).length > 0;
  const modHasPatches =
    mod.patches != null && Object.keys(mod.patches).length > 0;
  if (refHasPatches) {
    if (!_.isEqual(mod.patches, ref.patches)) {
      return false;
    }
    if (mod?.referenceTag !== ref?.tag) {
      return false;
    }
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
    if (
      ref.repo.repository !== mod.source ||
      ref.repo.modId !== (mod.modId || -1).toString()
    ) {
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
      //  If we reached this point, that means we matched patches/installer choices/fileList
      //  AND MD5 - this is good enough.
      return true;
    }
  }

  // right file?
  if (ref.logicalFileName != null) {
    if (mod.additionalLogicalFileNames != null) {
      if (
        !mod.additionalLogicalFileNames.includes(ref.logicalFileName) &&
        ![mod.logicalFileName, mod.customFileName].includes(
          ref.logicalFileName,
        ) &&
        ref.fileExpression == null
      ) {
        return false;
      }
    } else if (
      ![mod.logicalFileName, mod.customFileName].includes(
        ref.logicalFileName,
      ) &&
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
      if (
        baseName !== ref.fileExpression &&
        !minimatch(baseName, ref.fileExpression)
      ) {
        return false;
      }
    }
  }

  // right version?
  if (
    truthy(ref.versionMatch) &&
    ref.versionMatch !== "*" &&
    truthy(mod.version)
  ) {
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
  if (
    ref.gameId !== undefined &&
    mod.game !== undefined &&
    mod.game.indexOf(ref.gameId) === -1
  ) {
    return false;
  }

  if (source !== undefined && modId !== undefined && ref.idHint !== modId) {
    // if this resolved to a different mod
    onRefResolved?.(source.gameId, source.modId, ref, modId);
  }

  return true;
}

export function testRefByIdentifiers(
  identifiers: {
    gameId: string;
    modId?: number;
    fileId?: number;
    fileNames?: string[];
    fileIds?: string[];
    condition?: () => boolean;
  },
  ref: IModReference,
): boolean {
  if (
    identifiers == null ||
    typeof identifiers !== "object" ||
    Array.isArray(identifiers)
  ) {
    return false;
  }

  const { fileNames, modId, fileIds, condition } = identifiers;
  if (
    ref.repo?.modId != null &&
    modId != null &&
    ref.repo?.fileId != null &&
    fileIds != null &&
    fileIds.length > 0
  ) {
    if (
      ref.repo.modId === modId.toString() &&
      fileIds.includes(ref.repo.fileId)
    ) {
      return true;
    }
  }
  // If the reference specifies a repo mod id and the download has a known
  // (different) mod id, this is definitively not the right download - don't
  // fall through to weaker matching criteria like logicalFileName which can
  // produce false matches for generic names like "Main File"
  if (
    ref.repo?.modId != null &&
    modId != null &&
    !isNaN(modId) &&
    ref.repo.modId !== modId.toString()
  ) {
    return false;
  }
  // right file?
  if (
    ref.fileExpression == null &&
    ref.logicalFileName != null &&
    fileNames != null
  ) {
    if (fileNames.includes(ref.logicalFileName)) {
      return true;
    }
  }

  if (ref.fileExpression != null && fileNames != null) {
    // file expression is either an exact match against the mod name or
    // a glob match against the archive name (without file extension)
    for (const fileName of fileNames) {
      const baseName = sanitizeExpression(fileName);
      if (
        baseName === ref.fileExpression ||
        minimatch(baseName, ref.fileExpression)
      ) {
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
  cb: (
    gameId: string,
    sourceModId: string,
    ref: IModReference,
    modId: string,
  ) => void,
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

  if (
    reference == null ||
    typeof reference !== "object" ||
    Array.isArray(reference)
  ) {
    return false;
  }

  if ((mod as IMod).attributes) {
    return testRef(
      modAttributesToLookupInfo(mod),
      mod.id,
      reference,
      source,
      fuzzyVersion,
    );
  } else {
    const lookup = mod as IModLookupInfo;
    return testRef(lookup, lookup.id, reference, source, fuzzyVersion);
  }
}

export default testModReference;
