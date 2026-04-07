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
import * as os from "os";
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
const APPIMAGE_WRAPPER_FILE_NAME = "com.nexusmods.vortex.sh";

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
 * Discover all Firefox profile directories from both native and snap installations.
 * Reads profiles.ini from ~/.mozilla/firefox and ~/snap/firefox/common/.mozilla/firefox,
 * resolves each profile path, and returns those that exist on disk.
 */
export function findFirefoxProfileDirs(): string[] {
  const iniPaths = [
    path.join(os.homedir(), ".mozilla", "firefox", "profiles.ini"),
    path.join(
      os.homedir(),
      "snap",
      "firefox",
      "common",
      ".mozilla",
      "firefox",
      "profiles.ini",
    ),
  ];

  const results: string[] = [];

  for (const iniPath of iniPaths) {
    try {
      const content = fs.readFileSync(iniPath, { encoding: "utf8" });
      const iniDir = path.dirname(iniPath);

      // Parse [Profile...] sections
      let inProfileSection = false;
      let profilePath: string | null = null;
      let isRelative = true;

      for (const rawLine of content.split("\n")) {
        const line = rawLine.trim();

        if (line.startsWith("[Profile")) {
          // Flush previous section if any
          if (inProfileSection && profilePath !== null) {
            const resolved = isRelative
              ? path.join(iniDir, profilePath)
              : profilePath;
            if (fs.pathExistsSync(resolved)) {
              results.push(resolved);
            }
          }
          inProfileSection = true;
          profilePath = null;
          isRelative = true;
        } else if (line.startsWith("[")) {
          // A non-Profile section; flush and stop tracking
          if (inProfileSection && profilePath !== null) {
            const resolved = isRelative
              ? path.join(iniDir, profilePath)
              : profilePath;
            if (fs.pathExistsSync(resolved)) {
              results.push(resolved);
            }
          }
          inProfileSection = false;
          profilePath = null;
          isRelative = true;
        } else if (inProfileSection) {
          if (line.startsWith("Path=")) {
            profilePath = line.slice("Path=".length);
          } else if (line.startsWith("IsRelative=")) {
            isRelative = line.slice("IsRelative=".length) !== "0";
          }
        }
      }

      // Flush last section
      if (inProfileSection && profilePath !== null) {
        const resolved = isRelative
          ? path.join(iniDir, profilePath)
          : profilePath;
        if (fs.pathExistsSync(resolved)) {
          results.push(resolved);
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        log("warn", "failed to read firefox profiles.ini", {
          iniPath,
          error: (err as Error).message,
        });
      }
      // ENOENT: Firefox not installed at this path — silently skip
    }
  }

  return results;
}

/**
 * Remove the `nxm` scheme entry from Firefox's handlers.json if present.
 *
 * Firefox checks handlers.json before about:config prefs. An existing entry
 * (even with no configured app) overrides `network.protocol-handler.expose.nxm`
 * and prevents Firefox from routing nxm:// through xdg-desktop-portal.
 * Removing the entry lets the user.js pref take effect.
 *
 * Returns true if handlers.json was modified.
 */
export function clearFirefoxNxmHandlersEntry(profileDir: string): boolean {
  const handlersPath = path.join(profileDir, "handlers.json");

  let raw: string;
  try {
    raw = fs.readFileSync(handlersPath, { encoding: "utf8" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw err;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return false;
  }

  const schemes = data["schemes"] as Record<string, unknown> | undefined;
  if (!schemes || !(NXM_PROTOCOL in schemes)) {
    return false;
  }

  delete schemes[NXM_PROTOCOL];
  fs.outputFileSync(handlersPath, JSON.stringify(data, null, 2), {
    encoding: "utf8",
  });
  return true;
}

/**
 * Append `network.protocol-handler.expose.nxm = false` to Firefox user.js
 * if not already present. Returns true if the file was modified.
 */
export function ensureFirefoxNxmUserPref(profileDir: string): boolean {
  const userJsPath = path.join(profileDir, "user.js");
  let content = "";

  try {
    content = fs.readFileSync(userJsPath, { encoding: "utf8" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  if (content.includes("network.protocol-handler.expose.nxm")) {
    return false;
  }

  content +=
    'user_pref("network.protocol-handler.expose.nxm", false);\n';
  fs.outputFileSync(userJsPath, content, { encoding: "utf8" });
  return true;
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

  if (desktopId === PACKAGE_DESKTOP_ID && process.env.APPIMAGE) {
    didChangeDesktopFiles = ensureAppImageDesktopEntry(
      applicationsDir,
      process.env.APPIMAGE,
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

  const firefoxProfileDirs = findFirefoxProfileDirs();
  let patchedCount = 0;
  let clearedCount = 0;
  for (const profileDir of firefoxProfileDirs) {
    try {
      if (clearFirefoxNxmHandlersEntry(profileDir)) {
        clearedCount++;
      }
      if (ensureFirefoxNxmUserPref(profileDir)) {
        patchedCount++;
      }
    } catch (err) {
      log("warn", "failed to patch firefox profile for nxm", {
        profileDir,
        error: (err as Error).message,
      });
    }
  }
  if (firefoxProfileDirs.length > 0) {
    log("info", "patched firefox profiles for nxm routing", {
      userJsPatched: patchedCount,
      handlersCleared: clearedCount,
      total: firefoxProfileDirs.length,
    });
  }

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

/**
 * Generate the wrapper script content for executing Vortex.
 *
 * Note(sewer): xdg-utils has issues with the 'generic' fallback for `.desktop` files
 *              which will be used in non-mainstream DEs like Hyprland, Sway, i3, etc.
 *              We'll use a hack to work around this.
 * ref: https://github.com/Nexus-Mods/NexusMods.App/blob/main/src/NexusMods.Backend/OS/LinuxInterop.Protocol.cs#L76-L83
 * ref: https://gitlab.freedesktop.org/xdg/xdg-utils/-/issues/279
 * ref: https://github.com/Nexus-Mods/NexusMods.App/issues/3293
 *
 * So, here we're creating a wrapper script that will be used to execute the App.
 *
 * Wrapper script content must be escaped for POSIX shell, not desktop-entry parsing.
 * The desktop-entry escaping rules are applied separately to Exec/TryExec fields.
 * Vortex adds `appPath` because Electron launches as: <electron> <appPath> ...
 */
function generateWrapperScript(
  executablePath: string,
  appPath?: string,
): string {
  // Persist GTK/Electron environment variables used to run Vortex.
  // This is needed for Nix, such that you can launch the desktop entry outside
  // of the Nix devShell during development. For other environments, this will
  // typically be unset and be a no-op.
  const electronEnvVars = [
    "XDG_DATA_DIRS",
    "GIO_EXTRA_MODULES",
    "GDK_PIXBUF_MODULE_FILE",
    "CHROME_DEVEL_SANDBOX",
    "ELECTRON_OVERRIDE_DIST_PATH",
    "NODE_ENV",
  ];

  const electronEnvExports = electronEnvVars
    .map((varName) => {
      const value = process.env[varName];
      if (value) {
        return `export ${varName}="${escapeShellScriptArgument(value)}"`;
      }
      return null;
    })
    .filter((line): line is string => line !== null)
    .join("\n");

  return (
    "#!/bin/sh\n" +
    // Environment variables like LD_LIBRARY_PATH and LD_PRELOAD carried over from the
    // browser (e.g., Vivaldi) are a common cause of failures when launching external
    // applications. It's standard practice to unset both to prevent library conflicts.
    // This was encountered in practice on NixOS, where these variables caused
    // Electron to load incompatible libraries, resulting in a segfault when launching
    // Vortex from nxm:// links.
    "unset LD_LIBRARY_PATH\n" +
    "unset LD_PRELOAD\n" +
    (electronEnvExports ? electronEnvExports + "\n" : "") +
    // Propagate --no-sandbox if the current process was launched with it.
    // Required in environments where Electron cannot use the sandbox (Docker, VMs,
    // restricted kernels). Without this, the child Electron process launched by the
    // wrapper script will crash before requestSingleInstanceLock() runs.
    // Only pass --download when a parameter %u is provided (nxm:// links from browser).
    // This matches Windows behaviour, which includes --download on all protocol handler calls,
    // but does not on non-handler calls (e.g., when starting from the start menu).
    // AppImage builds are self-contained: no appPath positional argument needed.
    (() => {
      const noSandboxFlag = process.argv.includes("--no-sandbox")
        ? " --no-sandbox"
        : "";
      const escapedExec = escapeShellScriptArgument(executablePath);
      const appPathArg = appPath
        ? ` "${escapeShellScriptArgument(appPath)}"`
        : "";
      return (
        `if [ -n "$1" ]; then\n` +
        `  exec "${escapedExec}"${appPathArg}${noSandboxFlag} --download "$@"\n` +
        `else\n` +
        `  exec "${escapedExec}"${appPathArg}${noSandboxFlag}\n` +
        `fi\n`
      );
    })()
  );
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

  const wrapperContent = generateWrapperScript(executablePath, appPath);
  const wrapperChanged = writeFileIfChanged(wrapperPath, wrapperContent, 0o755);

  // The wrapper script adds --download conditionally when %u is provided.
  // This matches Windows behaviour where --download is only passed for protocol URLs.
  const desktopFileContent =
    "[Desktop Entry]\n" +
    "Type=Application\n" +
    "Name=Vortex (dev build)\n" +
    "GenericName=Mod Manager\n" +
    "Comment=Mod manager for PC games from Nexus Mods\n" +
    "NoDisplay=true\n" +
    `Exec=${escapedWrapperPathExec} %u\n` +
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

function ensureAppImageDesktopEntry(
  applicationsDir: string,
  appImagePath: string,
): boolean {
  const wrapperPath = path.join(applicationsDir, APPIMAGE_WRAPPER_FILE_NAME);
  const desktopFilePath = path.join(applicationsDir, PACKAGE_DESKTOP_ID);

  warnIfApplicationsPathNeedsEscaping(applicationsDir);

  const escapedWrapperPathExec = escapeDesktopExecFilePath(wrapperPath);
  const escapedWrapperPathTryExec = escapeDesktopFilePath(wrapperPath);

  // AppImage is self-contained -- no appPath needed (the AppImage is both the
  // executable and the app bundle; Electron's appPath positional arg is not used).
  const wrapperContent = generateWrapperScript(appImagePath);
  const wrapperChanged = writeFileIfChanged(wrapperPath, wrapperContent, 0o755);

  // The wrapper script adds --download conditionally when %u is provided.
  // This matches Windows behaviour where --download is only passed for protocol URLs.
  const desktopFileContent =
    "[Desktop Entry]\n" +
    "Type=Application\n" +
    "Name=Vortex\n" +
    "GenericName=Mod Manager\n" +
    "Comment=Mod manager for PC games from Nexus Mods\n" +
    "NoDisplay=true\n" +
    `Exec=${escapedWrapperPathExec} %u\n` +
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
