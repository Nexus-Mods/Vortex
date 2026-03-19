/**
 * Shared Linux protocol-registration helpers.
 * Keep protocol-agnostic command and path helpers here.
 *
 * IMPORTANT NOTES:
 *
 * 1. The 'nxm' protocol handler is heavily overloaded on Nexus Mods, with many tools using it
 *    (Mod Organizer 2, Vortex, NexusMods.App, etc.).
 *
 * 2. Community expectation is that the last program launched "wins" when registering for nxm://
 *    handler. Users frequently switch between mod managers, and they expect the active one to
 *    handle download links.
 *
 * 3. FLATPAK-SPAWN USAGE: In Flatpak sandbox, we spawn xdg-settings on the host via
 *    `flatpak-spawn --host` to override the current handler. This is unorthodox for Flatpak
 *    (which typically relies on static desktop file declarations), but necessary to meet
 *    the "last wins" expectation and to allow seamless switching between Flatpak and
 *    development builds without clashing.
 *
 *    NOTE FOR FLATHUB REVIEWERS: This escapes the sandbox to modify host MIME associations.
 *    This is intentional and required for mod manager UX. We consider this acceptable
 *    given that (a) users explicitly toggle "Handle Nexus Links" in settings, and (b) the
 *    modding community expects this behaviour.
 *
 * 4. We rely on xdg-utils being installed on the host system. This is a safe assumption
 *    as it is required by most browsers, and Steam (where people get their games).
 *    Virtually all desktop Linux distributions include it too.
 *
 * @module Linux protocol registration helpers
 */
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
 * Check if running inside a Flatpak sandbox.
 */
function isFlatpak(): boolean {
  return process.env.IS_FLATPAK === "true";
}

const FLATPAK_HOST_WORKDIR = "/";

function withFlatpakHostArgs(commandArgs: string[]): string[] {
  // Electron running from /app/main causes host-spawned commands to fail because
  // that path does not exist on the host filesystem.
  return ["--host", `--directory=${FLATPAK_HOST_WORKDIR}`, ...commandArgs];
}

/**
 * Read the current desktop-id associated with a URL scheme on Linux.
 * In Flatpak, uses flatpak-spawn to query the host's settings.
 */
export function getDefaultUrlSchemeHandler(
  protocol: string,
): string | undefined {
  const args = isFlatpak()
    ? withFlatpakHostArgs([
        "xdg-settings",
        "get",
        "default-url-scheme-handler",
        protocol,
      ])
    : ["get", "default-url-scheme-handler", protocol];
  const command = isFlatpak() ? "flatpak-spawn" : "xdg-settings";
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
 * In Flatpak, uses flatpak-spawn to modify the host's settings.
 * ref: https://github.com/Nexus-Mods/NexusMods.App/blob/main/src/NexusMods.Backend/RuntimeDependency/XDGSettingsDependency.cs#L22-L34
 */
export function setDefaultUrlSchemeHandler(
  protocol: string,
  desktopId: string,
): void {
  const args = isFlatpak()
    ? withFlatpakHostArgs([
        "xdg-settings",
        "set",
        "default-url-scheme-handler",
        protocol,
        desktopId,
      ])
    : ["set", "default-url-scheme-handler", protocol, desktopId];
  const command = isFlatpak() ? "flatpak-spawn" : "xdg-settings";
  const fullCommand = [command, ...args].join(" ");
  log(
    "info",
    isFlatpak()
      ? "flatpak-spawn: setting nxm handler on host"
      : "setting nxm handler",
    {
      command: fullCommand,
    },
  );
  const result = runCommand(command, args);

  // Log the result regardless of success/failure for debugging
  if (result.error !== undefined) {
    log("error", "linux protocol command failed to execute", {
      command,
      args,
      fullCommand,
      error: result.error.message,
      code: result.error.code,
    });
  } else if (result.status !== 0) {
    log("error", "linux protocol command returned non-zero exit code", {
      command,
      args,
      fullCommand,
      status: result.status,
      stderr: result.stderr.trim(),
      stdout: result.stdout.trim(),
    });
  } else {
    log("info", "linux protocol command succeeded", {
      command,
      args,
      fullCommand,
      stdout: result.stdout.trim(),
    });
  }
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
