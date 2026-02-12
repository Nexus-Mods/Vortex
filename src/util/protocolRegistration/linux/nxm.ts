/**
 * Linux-specific nxm:// registration for Vortex.
 *
 * This aligns with NexusMods.App behaviour:
 * - use `xdg-settings` for default handler assignment
 * - update desktop MIME cache with `update-desktop-database` when desktop files change
 * - generate a local dev desktop entry that uses `--download %u` like other Vortex builds
 *
 * ref: https://github.com/Nexus-Mods/NexusMods.App/blob/main/src/NexusMods.Backend/OS/LinuxInterop.Protocol.cs
 * ref: https://github.com/Nexus-Mods/NexusMods.App/blob/main/src/NexusMods.Backend/RuntimeDependency/XDGSettingsDependency.cs
 * ref: https://github.com/Nexus-Mods/NexusMods.App/blob/main/src/NexusMods.Backend/RuntimeDependency/UpdateDesktopDatabaseDependency.cs
 */

import * as fs from "fs-extra";
import * as path from "path";

import { log } from "../../log";
import {
  escapeDesktopExecFilePath,
  escapeDesktopFilePath,
} from "./desktopFileEscaping";
import {
  applicationsDirectory,
  getDefaultUrlSchemeHandler,
  refreshDesktopDatabase,
  setDefaultUrlSchemeHandler,
} from "./common";

const NXM_PROTOCOL = "nxm";
const PACKAGE_DESKTOP_ID = "com.nexusmods.vortex.desktop";
const DEV_DESKTOP_ID = "com.nexusmods.vortex.dev.desktop";
const DEV_WRAPPER_FILE_NAME = "com.nexusmods.vortex.dev.sh";

/**
 * Required registration inputs for Linux `nxm` routing.
 * These values are resolved by the Linux route dispatcher before calling this module.
 */
export interface ILinuxNxmProtocolRegistrationOptions {
  setAsDefault: boolean;
  executablePath: string;
  appPath: string;
}

/**
 * Register Vortex as the handler for nxm:// protocol on Linux.
 * See file-level comment above for implementation details.
 */
export function registerLinuxNxmProtocolHandler(
  options: ILinuxNxmProtocolRegistrationOptions,
): boolean {
  if (process.platform !== "linux") {
    return false;
  }

  const applicationsDir = applicationsDirectory();
  const desktopId = desktopIdForCurrentBuild();

  let didChangeDesktopFiles = false;
  if (desktopId === DEV_DESKTOP_ID) {
    didChangeDesktopFiles = ensureDevDesktopEntry(
      applicationsDir,
      options.executablePath,
      options.appPath,
    );
  }

  if (didChangeDesktopFiles) {
    refreshDesktopDatabase(applicationsDir);
  }

  if (!options.setAsDefault) {
    return false;
  }

  const previousHandler = getDefaultUrlSchemeHandler(NXM_PROTOCOL);
  const haveToRegister = previousHandler !== desktopId;
  setDefaultUrlSchemeHandler(NXM_PROTOCOL, desktopId);

  return haveToRegister;
}

/**
 * Linux `nxm` deregistration intentionally does not remove desktop associations.
 *
 * As with previous behaviour, Linux deregistration is treated as external/system-managed.
 */
export function deregisterLinuxNxmProtocolHandler(): void {
  if (process.platform === "linux") {
    log("debug", "linux protocol deregistration is handled externally", {
      protocol: NXM_PROTOCOL,
    });
  }
}

function isFlatpakBuild(): boolean {
  return process.env.IS_FLATPAK === "true";
}

function isDevelopmentBuild(): boolean {
  return process.defaultApp === true || process.env.NODE_ENV === "development";
}

function desktopIdForCurrentBuild(): string {
  if (isFlatpakBuild()) {
    return PACKAGE_DESKTOP_ID;
  }

  if (isDevelopmentBuild()) {
    return DEV_DESKTOP_ID;
  }

  return PACKAGE_DESKTOP_ID;
}

function escapeShellScriptArgument(input: string): string {
  return input.replace(/(["\\$`])/g, "\\$1");
}

function writeFileIfChanged(
  filePath: string,
  content: string,
  mode?: number,
): boolean {
  let changed = true;

  try {
    changed = fs.readFileSync(filePath, { encoding: "utf8" }) !== content;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  if (changed) {
    fs.outputFileSync(filePath, content, { encoding: "utf8" });
  }

  if (mode !== undefined) {
    fs.chmodSync(filePath, mode);
  }

  return changed;
}

function warnIfApplicationsPathNeedsEscaping(applicationsDir: string): void {
  if (escapeDesktopExecFilePath(applicationsDir) !== applicationsDir) {
    // If XDG_DATA_HOME itself requires escaping, the wrapper workaround may still fail
    // in affected xdg-utils fallback paths (outside our control).
    // ref: https://gitlab.freedesktop.org/xdg/xdg-utils/-/issues/279
    // ref: https://github.com/Nexus-Mods/NexusMods.App/issues/3293
    // ref: https://github.com/Nexus-Mods/NexusMods.App/blob/main/src/NexusMods.Backend/OS/LinuxInterop.Protocol.cs#L121-L125
    log("warn", "linux applications directory path requires escaping", {
      applicationsDir,
    });
  }
}

function ensureDevDesktopEntry(
  applicationsDir: string,
  executablePath: string,
  appPath: string,
): boolean {
  const wrapperPath = path.join(applicationsDir, DEV_WRAPPER_FILE_NAME);
  const desktopFilePath = path.join(applicationsDir, DEV_DESKTOP_ID);

  warnIfApplicationsPathNeedsEscaping(applicationsDir);

  const escapedWrapperPathExec = escapeDesktopExecFilePath(wrapperPath);
  const escapedWrapperPathTryExec = escapeDesktopFilePath(wrapperPath);
  // Note(sewer): xdg-utils has issues with the 'generic' fallback for `.desktop` files
  //              which will be used in non-mainstream DEs like Hyprland, Sway, i3, etc.
  //              We'll use a hack to work around this.
  // ref: https://github.com/Nexus-Mods/NexusMods.App/blob/main/src/NexusMods.Backend/OS/LinuxInterop.Protocol.cs#L76-L83
  // ref: https://gitlab.freedesktop.org/xdg/xdg-utils/-/issues/279
  // ref: https://github.com/Nexus-Mods/NexusMods.App/issues/3293
  //
  // So, here we're creating a wrapper script that will be used to execute the App.
  //
  // Wrapper script content must be escaped for POSIX shell, not desktop-entry parsing.
  // The desktop-entry escaping rules are applied separately to Exec/TryExec fields.
  // Vortex adds `appPath` because Electron launches as: <electron> <appPath> ...

  const wrapperContent =
    "#!/bin/sh\n" +
    `exec "${escapeShellScriptArgument(executablePath)}" "${escapeShellScriptArgument(appPath)}" "$@"\n`;

  const wrapperChanged = writeFileIfChanged(wrapperPath, wrapperContent, 0o755);

  // Keep Linux launch arguments consistent with other Vortex desktop entries
  // by using `--download %u` rather than relying on positional `%u`.
  // ref: https://github.com/Nexus-Mods/NexusMods.App/blob/main/src/NexusMods.App/com.nexusmods.app.desktop#L13
  // ref: https://github.com/Nexus-Mods/NexusMods.App/blob/main/src/NexusMods.Backend/OS/LinuxInterop.Protocol.cs#L55-L62
  const desktopFileContent =
    "[Desktop Entry]\n" +
    "Type=Application\n" +
    "Name=Vortex (dev build)\n" +
    "GenericName=Mod Manager\n" +
    "Comment=Mod manager for PC games from Nexus Mods\n" +
    "NoDisplay=true\n" +
    `Exec=${escapedWrapperPathExec} --download %u\n` +
    `TryExec=${escapedWrapperPathTryExec}\n` +
    "Icon=com.nexusmods.vortex\n" +
    "Terminal=false\n" +
    "Categories=Game;Utility;\n" +
    "MimeType=x-scheme-handler/nxm;\n" +
    "StartupWMClass=Vortex\n" +
    "StartupNotify=true\n" +
    "Keywords=mod;mods;modding;nexus;games;skyrim;fallout;\n";

  const desktopChanged = writeFileIfChanged(
    desktopFilePath,
    desktopFileContent,
    0o755,
  );

  return wrapperChanged || desktopChanged;
}
