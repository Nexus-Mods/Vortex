// Shared Linux protocol-registration helpers.
// Keep protocol-agnostic command and path helpers here.
import { spawnSync } from "child_process";
import * as os from "os";
import * as path from "path";

import { log } from "../../log";

interface ICommandResult {
  status: number;
  stdout: string;
  stderr: string;
  error?: NodeJS.ErrnoException;
}

/**
 * Resolve the writable Linux applications directory used for local desktop entries.
 */
export function applicationsDirectory(): string {
  const xdgDataHome = process.env.XDG_DATA_HOME;
  const dataHome =
    xdgDataHome != null && xdgDataHome.length > 0
      ? xdgDataHome
      : path.join(os.homedir(), ".local", "share");
  return path.join(dataHome, "applications");
}

/**
 * Refresh the Linux desktop MIME cache after desktop entry changes.
 */
export function refreshDesktopDatabase(applicationsDir: string): void {
  // ref: https://github.com/Nexus-Mods/NexusMods.App/blob/main/src/NexusMods.Backend/RuntimeDependency/UpdateDesktopDatabaseDependency.cs#L18-L28
  const command = "update-desktop-database";
  const args = [applicationsDir];
  const result = runCommand(command, args);
  logCommandFailure(command, args, result);
}

/**
 * Read the current desktop-id associated with a URL scheme on Linux.
 */
export function getDefaultUrlSchemeHandler(
  protocol: string,
): string | undefined {
  const command = "xdg-settings";
  const args = ["get", "default-url-scheme-handler", protocol];
  const result = runCommand(command, args);

  if (result.error !== undefined || result.status !== 0) {
    logCommandFailure(command, args, result);
    return undefined;
  }

  const output = result.stdout.trim();
  return output.length > 0 ? output : undefined;
}

/**
 * Set the desktop-id that should handle a URL scheme on Linux.
 */
export function setDefaultUrlSchemeHandler(
  protocol: string,
  desktopId: string,
): void {
  // ref: https://github.com/Nexus-Mods/NexusMods.App/blob/main/src/NexusMods.Backend/RuntimeDependency/XDGSettingsDependency.cs#L22-L34
  const command = "xdg-settings";
  const args = ["set", "default-url-scheme-handler", protocol, desktopId];
  const result = runCommand(command, args);
  logCommandFailure(command, args, result);
}

function runCommand(command: string, args: string[]): ICommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error as NodeJS.ErrnoException,
  };
}

function logCommandFailure(
  command: string,
  args: string[],
  result: ICommandResult,
): void {
  if (result.error !== undefined) {
    if (result.error.code !== "ENOENT") {
      log("debug", "linux protocol command failed", {
        command,
        args,
        error: result.error.message,
      });
    }
    return;
  }

  if (result.status !== 0) {
    log("debug", "linux protocol command returned non-zero exit code", {
      command,
      args,
      status: result.status,
      stderr: result.stderr.trim(),
    });
  }
}
