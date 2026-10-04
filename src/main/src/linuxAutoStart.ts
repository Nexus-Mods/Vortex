import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ENTRY_NAME = "com.nexusmods.vortex.desktop";

/** Where XDG autostart entries live, see the Desktop Application Autostart spec */
export function autoStartDirectory(): string {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(configHome, "autostart");
}

// quoting rules of the Exec key, then the general string escaping of desktop entries
function quoteExecArg(arg: string): string {
  const quoted = `"${arg.replace(/(["`$\\])/g, "\\$1")}"`;
  return quoted.replace(/\\/g, "\\\\");
}

/**
 * Builds the autostart desktop entry for the given command line.
 * The first element is the executable.
 */
export function autoStartEntry(command: string[]): string {
  return (
    "[Desktop Entry]\n" +
    "Type=Application\n" +
    "Name=Vortex\n" +
    "Comment=Mod manager for PC games from Nexus Mods\n" +
    `Exec=${command.map(quoteExecArg).join(" ")}\n` +
    "Icon=com.nexusmods.vortex\n" +
    "Terminal=false\n" +
    "X-GNOME-Autostart-enabled=true\n"
  );
}

/**
 * Adds or removes the XDG autostart entry, which is how Linux desktops start
 * applications at login.
 */
export function setLinuxAutoStart(enabled: boolean, command: string[]): void {
  const entryPath = path.join(autoStartDirectory(), ENTRY_NAME);
  if (!enabled) {
    rmSync(entryPath, { force: true });
    return;
  }
  mkdirSync(path.dirname(entryPath), { recursive: true });
  writeFileSync(entryPath, autoStartEntry(command));
}
