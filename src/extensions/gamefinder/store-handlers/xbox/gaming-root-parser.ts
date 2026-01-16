/**
 * Parser for .GamingRoot binary files
 * These files are stored at the root of drives and contain paths to game installation directories
 */

import { readFileSync } from "fs";
import { Result, ok, err } from "neverthrow";
import type { GameFinderError } from "../../common";

const EXPECTED_MAGIC = 0x58424752; // 'RGBX' in little-endian

/**
 * Parse a .GamingRoot file to extract game installation paths
 */
export function parseGamingRootFile(
  filePath: string,
): Result<string[], GameFinderError> {
  try {
    const buffer = readFileSync(filePath);

    // Read magic number (first 4 bytes, little-endian)
    if (buffer.length < 8) {
      return err({
        code: "XBOX_GAMING_ROOT_INVALID",
        message: `File ${filePath} is too small to be a valid .GamingRoot file`,
      });
    }

    const magic = buffer.readUInt32LE(0);
    if (magic !== EXPECTED_MAGIC) {
      return err({
        code: "XBOX_GAMING_ROOT_INVALID",
        message: `Invalid magic number in ${filePath}: expected 0x${EXPECTED_MAGIC.toString(16)}, got 0x${magic.toString(16)}`,
      });
    }

    // Read folder count (next 4 bytes, little-endian)
    const folderCount = buffer.readUInt32LE(4);
    if (folderCount >= 255) {
      return err({
        code: "XBOX_GAMING_ROOT_INVALID",
        message: `Folder count exceeds limit: ${folderCount}`,
      });
    }

    // Read folder paths (Unicode/UTF-16LE null-terminated strings)
    const folders: string[] = [];
    let offset = 8;

    for (let i = 0; i < folderCount; i++) {
      const chars: number[] = [];

      // Read UTF-16LE characters until null terminator
      while (offset + 1 < buffer.length) {
        const charCode = buffer.readUInt16LE(offset);
        offset += 2;

        if (charCode === 0) {
          break;
        }

        chars.push(charCode);
      }

      if (chars.length > 0) {
        const folderPath = String.fromCharCode(...chars);
        folders.push(folderPath);
      }
    }

    return ok(folders);
  } catch (error) {
    return err({
      code: "XBOX_GAMING_ROOT_ERROR",
      message: `Failed to parse .GamingRoot file: ${filePath}`,
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
