/**
 * Parser for Steam's libraryfolders.vdf file
 */

import { Result, ok, err } from "neverthrow";
import type { GameFinderError } from "../../common";
import type { LibraryFolder, AppId } from "./types";
import {
  parseVdfFile,
  getObject,
  getString,
  getBigInt,
  type VdfObject,
} from "./vdf-parser";

/**
 * Parse a single library folder entry from the VDF
 */
function parseLibraryFolderEntry(
  _index: string,
  entry: VdfObject,
): Result<LibraryFolder, GameFinderError> {
  const path = getString(entry, "path");
  if (path === undefined) {
    return err({
      code: "VDF_MISSING_FIELD",
      message: "Missing required field 'path' in library folder entry",
    });
  }

  const label = getString(entry, "label") ?? "";
  const totalDiskSize = getBigInt(entry, "totalsize");

  // Parse app sizes map
  const appSizes = new Map<AppId, bigint>();
  const appsObj = getObject(entry, "apps");
  if (appsObj !== undefined) {
    for (const [appIdStr, sizeValue] of Object.entries(appsObj)) {
      const appId = parseInt(appIdStr, 10);
      if (!isNaN(appId)) {
        // Size can be number or string
        const size =
          typeof sizeValue === "number"
            ? BigInt(sizeValue)
            : typeof sizeValue === "string"
              ? BigInt(sizeValue)
              : BigInt(0);
        appSizes.set(appId, size);
      }
    }
  }

  return ok({
    path,
    label,
    totalDiskSize,
    appSizes,
  });
}

/**
 * Parse the libraryfolders.vdf file
 */
export function parseLibraryFolders(
  filePath: string,
): Result<LibraryFolder[], GameFinderError> {
  const parseResult = parseVdfFile(filePath);
  if (parseResult.isErr()) {
    return err(parseResult.error);
  }

  const root = parseResult.value;

  // The root should contain a "libraryfolders" object
  const libraryFoldersObj = getObject(root, "libraryfolders");
  if (libraryFoldersObj === undefined) {
    return err({
      code: "VDF_INVALID_FORMAT",
      message: `Invalid libraryfolders.vdf format: missing 'libraryfolders' root object in ${filePath}`,
    });
  }

  const folders: LibraryFolder[] = [];
  const errors: GameFinderError[] = [];

  // Each numeric key (0, 1, 2, ...) is a library folder
  for (const [key, value] of Object.entries(libraryFoldersObj)) {
    // Skip non-numeric keys (like "contentstatsid")
    if (!/^\d+$/.test(key)) {
      continue;
    }

    if (typeof value !== "object" || value === null) {
      continue;
    }

    const folderResult = parseLibraryFolderEntry(key, value);
    if (folderResult.isOk()) {
      folders.push(folderResult.value);
    } else {
      errors.push(folderResult.error);
    }
  }

  // Return folders even if some had errors
  if (folders.length === 0 && errors.length > 0) {
    return err({
      code: "VDF_PARSE_ERROR",
      message: `Failed to parse any library folders: ${errors.map((e) => e.message).join(", ")}`,
    });
  }

  return ok(folders);
}
