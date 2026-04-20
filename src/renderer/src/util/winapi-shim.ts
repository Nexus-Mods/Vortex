/**
 * Linux shim for the Windows-only `winapi-bindings` native module.
 *
 * Provides:
 *   - Functional Linux equivalents for GetDiskFreeSpaceEx, GetVolumePathName,
 *     GetNativeArch, SetProcessPreferredUILanguages (WAPI-02, WAPI-03)
 *   - Throwing stubs for Windows-only elevated / UI operations (WAPI-04)
 *   - Safe no-op / empty-return stubs for registry, ACL, task scheduler, etc. (WAPI-05)
 *   - Both named exports and a default export object covering every function so
 *     `import winapi from "winapi-bindings"` and `import * as winapi from "..."` both work
 *
 * NOTE: The Jest mock at src/renderer/src/__mocks__/winapi-bindings.js is NOT modified
 * by this shim — it exists for existing renderer unit tests and deliberately diverges
 * (e.g. RegGetValue returns an object there).
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function unsupported(name: string): never {
  throw new Error(`${name} is not supported on Linux`);
}

// ---------------------------------------------------------------------------
// FUNCTIONAL STUBS (real Linux equivalents)
// ---------------------------------------------------------------------------

/**
 * Returns available disk space for the volume containing filePath.
 * Uses fs.statfsSync which exposes POSIX statvfs data.
 * Callers already catch errors, so ENOENT is allowed to propagate.
 */
export function GetDiskFreeSpaceEx(
  filePath: string,
): { total: number; free: number; freeToCaller: number } {
  const stats = fs.statfsSync(filePath);
  return {
    total: stats.blocks * stats.bsize,
    free: stats.bfree * stats.bsize,
    freeToCaller: stats.bavail * stats.bsize,
  };
}

/**
 * Returns the mount-point path for the volume containing filePath.
 * Walks up the directory tree comparing st_dev values. When a device
 * boundary is crossed the previous path is the mount point.
 * Falls back to path.parse(p).root on ENOENT (always "/" on Linux).
 */
export function GetVolumePathName(filePath: string): string {
  try {
    const targetDev = fs.statSync(filePath).dev;
    let current = path.resolve(filePath);
    while (true) {
      const parent = path.dirname(current);
      if (parent === current) {
        return current;
      }
      try {
        if (fs.statSync(parent).dev !== targetDev) {
          return current;
        }
      } catch {
        return current;
      }
      current = parent;
    }
  } catch {
    return path.parse(path.resolve(filePath)).root;
  }
}

/** Returns the current architecture. usedFallback is always false on Linux. */
export function GetNativeArch(): {
  nativeMachineCode: number;
  nativeArch: string;
  usedFallback: boolean;
} {
  return { nativeMachineCode: 0, nativeArch: process.arch, usedFallback: false };
}

/** No-op — language preference is handled via environment variables on Linux. */
export function SetProcessPreferredUILanguages(_languages: string[]): void {
  // no-op
}

// ---------------------------------------------------------------------------
// THROWING STUBS — Windows-only features that callers already catch
// ---------------------------------------------------------------------------

export function ShellExecuteEx(_options: unknown): void {
  throw new Error(
    "ShellExecuteEx is not supported on Linux — elevation requires pkexec (deferred)",
  );
}

export function CreateTask(_name: string, _options: unknown): void {
  unsupported("CreateTask");
}

export function RunTask(_name: string): void {
  unsupported("RunTask");
}

export function StopTask(_name: string): void {
  unsupported("StopTask");
}

export function DeleteTask(_name: string): void {
  unsupported("DeleteTask");
}

export function InitiateSystemShutdown(
  _message: string,
  _delay: number,
  _askToClose: boolean,
  _reboot: boolean,
): boolean {
  return unsupported("InitiateSystemShutdown");
}

export function AbortSystemShutdown(): boolean {
  return unsupported("AbortSystemShutdown");
}

export function CreateAppContainer(
  _containerName: string,
  _displayName: string,
  _description: string,
): void {
  unsupported("CreateAppContainer");
}

export function DeleteAppContainer(_containerName: string): void {
  unsupported("DeleteAppContainer");
}

export function GrantAppContainer(
  _containerName: string,
  _objectName: string,
  _typeName: string,
  _permissions: unknown[],
): void {
  unsupported("GrantAppContainer");
}

export function RunInContainer(
  _containerName: string,
  _commandLine: string,
  _cwdPath: string,
  _onExit: (code: number) => void,
  _onStdOut: (message: string) => void,
): void {
  unsupported("RunInContainer");
}

export function CreateProcessWithIntegrity(
  _commandLine: string,
  _cwdPath: string,
  _integrity: string,
  _onExit: (code: number) => void,
  _onStdOut: (message: string) => void,
): void {
  unsupported("CreateProcessWithIntegrity");
}

export function AddUserPrivilege(_sid: string, _privilege: string): void {
  unsupported("AddUserPrivilege");
}

export function RemoveUserPrivilege(_sid: string, _privilege: string): void {
  unsupported("RemoveUserPrivilege");
}

export function GetUserPrivilege(_sid: string): string[] {
  return unsupported("GetUserPrivilege");
}

export function GetFileVersionInfo(_filePath: string): never {
  return unsupported("GetFileVersionInfo");
}

export function SHGetKnownFolderPath(_folder: string, _flag?: string[]): string {
  return unsupported("SHGetKnownFolderPath");
}

// ---------------------------------------------------------------------------
// NO-OP / SAFE RETURN STUBS — registry, ACL, process, task scheduler, etc.
// ---------------------------------------------------------------------------

export function RegGetValue(
  _hkey: unknown,
  _path: string,
  _key: string,
): undefined {
  return undefined;
}

export function RegSetKeyValue(
  _key: unknown,
  _path: string,
  _keyName: string,
  _value: unknown,
): void {
  // no-op
}

export function RegEnumKeys(
  _hkey: unknown,
): Array<{ class: string; key: string; lastWritten: number }> {
  return [];
}

export function RegEnumValues(
  _hkey: unknown,
): Array<{ type: string; key: string }> {
  return [];
}

export function WithRegOpen(
  _hive: unknown,
  _path: string,
  _cb: (hkey: unknown) => void,
): void {
  // no-op — deliberately does NOT call _cb to avoid registry-dependent code paths
}

export function GetProcessList(): unknown[] {
  return [];
}

export function GetModuleList(_pid: number): unknown[] {
  return [];
}

export function GetProcessWindowList(_pid: number): number[] {
  return [];
}

export function SetForegroundWindow(_hwnd: number): boolean {
  return false;
}

export function GetUserSID(): string {
  return "";
}

export function LookupAccountName(_name: string): undefined {
  return undefined;
}

export function CheckYourPrivilege(): unknown[] {
  return [];
}

export function GetTasks(_path?: string): unknown[] {
  return [];
}

export function SupportsAppContainer(): boolean {
  return false;
}

export function IsThisWine(): boolean {
  return false;
}

export function WhoLocks(_filePath: string): unknown[] {
  return [];
}

/**
 * Immediately calls the callback with null (no entries, no error).
 * Supports both the 3-arg and 4-arg overloads from index.d.ts.
 */
export function WalkDir(
  _basePath: string,
  _progress: (entries: unknown[]) => boolean,
  ...args: unknown[]
): void {
  // last argument is always the callback
  const cb = args[args.length - 1];
  if (typeof cb === "function") {
    cb(null);
  }
}

export function SetFileAttributes(
  _filePath: string,
  _attributes: unknown[],
): void {
  // no-op
}

export function AddFileACE(_acc: unknown, _filePath: string): void {
  // no-op
}

export function GetProcessToken(
  _type: string,
  _pid?: number,
): { isElevated: boolean } {
  return { isElevated: false };
}

export function GetPrivateProfileSection(
  _section: string,
  _fileName: string,
): string {
  return "";
}

export function GetPrivateProfileSectionNames(_fileName: string): string[] {
  return [];
}

export function GetPrivateProfileString(
  _section: string,
  _key: string,
  _defaultValue: string,
  _fileName: string,
): string {
  return "";
}

export function WritePrivateProfileString(
  _section: string,
  _key: string,
  _value: string,
  _fileName: string,
): void {
  // no-op
}

export function GetSystemPreferredUILanguages(): string[] {
  return [];
}

export function GetUserPreferredUILanguages(): string[] {
  return [];
}

export function GetProcessPreferredUILanguages(): string[] {
  return [];
}

// ---------------------------------------------------------------------------
// Access constant
// ---------------------------------------------------------------------------

export const Access = {
  Grant: (_sid: unknown, _permissions: unknown) => ({} as unknown),
  Deny: (_sid: unknown, _permissions: unknown) => ({} as unknown),
  Revoke: (_sid: unknown, _permissions: unknown) => ({} as unknown),
};

// ---------------------------------------------------------------------------
// Default export — aggregates all named exports so both import styles work:
//   import winapi from "winapi-bindings"        (default import)
//   import * as winapi from "winapi-bindings"   (namespace import)
// ---------------------------------------------------------------------------

const winapiShim = {
  GetDiskFreeSpaceEx,
  GetVolumePathName,
  GetNativeArch,
  SetProcessPreferredUILanguages,
  ShellExecuteEx,
  CreateTask,
  RunTask,
  StopTask,
  DeleteTask,
  InitiateSystemShutdown,
  AbortSystemShutdown,
  CreateAppContainer,
  DeleteAppContainer,
  GrantAppContainer,
  RunInContainer,
  CreateProcessWithIntegrity,
  AddUserPrivilege,
  RemoveUserPrivilege,
  GetUserPrivilege,
  GetFileVersionInfo,
  SHGetKnownFolderPath,
  RegGetValue,
  RegSetKeyValue,
  RegEnumKeys,
  RegEnumValues,
  WithRegOpen,
  GetProcessList,
  GetModuleList,
  GetProcessWindowList,
  SetForegroundWindow,
  GetUserSID,
  LookupAccountName,
  CheckYourPrivilege,
  GetTasks,
  SupportsAppContainer,
  IsThisWine,
  WhoLocks,
  WalkDir,
  SetFileAttributes,
  AddFileACE,
  GetProcessToken,
  GetPrivateProfileSection,
  GetPrivateProfileSectionNames,
  GetPrivateProfileString,
  WritePrivateProfileString,
  GetSystemPreferredUILanguages,
  GetUserPreferredUILanguages,
  GetProcessPreferredUILanguages,
  Access,
};

export default winapiShim;
