/**
 * VDF (Valve Data Format) parsing utilities
 * Handles both .vdf and .acf files
 */

import { readFileSync } from "fs";
import { parse as parseVdf } from "simple-vdf";
import { Result, ok, err } from "neverthrow";
import type { GameFinderError } from "../../common";

/**
 * VDF Object type - can be a nested object or primitive value
 * Note: vdf-parser converts numeric strings to numbers automatically
 */
export type VdfValue = string | number | VdfObject;
export type VdfObject = { [key: string]: VdfValue };

/**
 * Parse a VDF/ACF file and return the root object
 */
export function parseVdfFile(
  filePath: string,
): Result<VdfObject, GameFinderError> {
  try {
    const content = readFileSync(filePath, "utf8");
    const parsed = parseVdf(content) as VdfObject;
    return ok(parsed);
  } catch (error) {
    return err({
      code: "VDF_PARSE_ERROR",
      message: `Failed to parse VDF file: ${filePath}`,
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

/**
 * Get a string value from a VDF object
 * Handles both string and number values (vdf-parser auto-converts numeric strings)
 */
export function getString(obj: VdfObject, key: string): string | undefined {
  const value = obj[key];
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return undefined;
}

/**
 * Get a required string value from a VDF object
 */
export function getRequiredString(
  obj: VdfObject,
  key: string,
  context: string,
): Result<string, GameFinderError> {
  const value = getString(obj, key);
  if (value === undefined) {
    return err({
      code: "VDF_MISSING_FIELD",
      message: `Missing required field '${key}' in ${context}`,
    });
  }
  return ok(value);
}

/**
 * Get a child object from a VDF object
 */
export function getObject(obj: VdfObject, key: string): VdfObject | undefined {
  const value = obj[key];
  if (typeof value === "object" && value !== null) {
    return value;
  }
  return undefined;
}

/**
 * Get a required child object from a VDF object
 */
export function getRequiredObject(
  obj: VdfObject,
  key: string,
  context: string,
): Result<VdfObject, GameFinderError> {
  const value = getObject(obj, key);
  if (value === undefined) {
    return err({
      code: "VDF_MISSING_FIELD",
      message: `Missing required object '${key}' in ${context}`,
    });
  }
  return ok(value);
}

/**
 * Get a numeric value from a VDF object
 * Handles both string and number values
 */
export function getNumber(obj: VdfObject, key: string): number | undefined {
  const value = obj[key];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

/**
 * Get a bigint value from a VDF object
 * Handles both string and number values
 */
export function getBigInt(obj: VdfObject, key: string): bigint {
  const value = obj[key];
  if (typeof value === "number") {
    return BigInt(value);
  }
  if (typeof value === "string") {
    try {
      return BigInt(value);
    } catch {
      return BigInt(0);
    }
  }
  return BigInt(0);
}

/**
 * Parse a numeric string to a number
 */
export function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const num = parseInt(value, 10);
  return isNaN(num) ? undefined : num;
}

/**
 * Parse a numeric string to a bigint
 */
export function parseBigInt(value: string | undefined): bigint {
  if (value === undefined) {
    return BigInt(0);
  }
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}

/**
 * Parse a Unix timestamp to a Date
 */
export function parseTimestamp(value: string | undefined): Date | undefined {
  const num = parseNumber(value);
  if (num === undefined || num === 0) {
    return undefined;
  }
  return new Date(num * 1000);
}
