/**
 * Read version info from Windows PE executables.
 *
 * Drop-in replacement for the native exe-version package. Parses PE headers
 * directly in TypeScript — no native addons or winapi-bindings dependency.
 */

import { readVersionInfo } from "./peVersion";

export function getFileVersion(exeFile: string): string {
  if (process.platform !== "win32") return "";
  const info = readVersionInfo(exeFile);
  if (info === undefined) return "";
  return info.fileVersion.join(".");
}

export function getProductVersion(exeFile: string): string {
  if (process.platform !== "win32") return "";
  const info = readVersionInfo(exeFile);
  if (info === undefined) return "";
  return info.productVersion.join(".");
}

export function getFileVersionLocalized(exeFile: string): string {
  if (process.platform !== "win32") return getFileVersion(exeFile);
  const info = readVersionInfo(exeFile);
  if (info === undefined) return "";
  return info.fileVersionString;
}

export function getProductVersionLocalized(exeFile: string): string {
  if (process.platform !== "win32") return getProductVersion(exeFile);
  const info = readVersionInfo(exeFile);
  if (info === undefined) return "";
  return info.productVersionString;
}

export default getFileVersion;
