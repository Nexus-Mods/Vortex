import { escapeDesktopExecFilePath } from "@vortex/shared";
import type { FileSystem, QualifiedPath } from "@vortex/shared/filesystem";

const ENTRY_NAME = "com.nexusmods.vortex.desktop";

/**
 * Builds the autostart desktop entry for the given command line.
 * The first element is the executable.
 */
function autoStartEntry(command: string[]): string {
  return (
    "[Desktop Entry]\n" +
    "Type=Application\n" +
    "Name=Vortex\n" +
    "Comment=Mod manager for PC games from Nexus Mods\n" +
    `Exec=${command.map(escapeDesktopExecFilePath).join(" ")}\n` +
    "Icon=com.nexusmods.vortex\n" +
    "Terminal=false\n"
  );
}

/**
 * Adds or removes the XDG autostart entry in `configHome`, which is how Linux
 * desktops start applications at login.
 */
export async function setLinuxAutoStart(
  fs: FileSystem,
  configHome: QualifiedPath,
  enabled: boolean,
  command: string[],
): Promise<void> {
  const directory = configHome.join("autostart");
  const entry = directory.join(ENTRY_NAME);
  if (!enabled) {
    if ((await fs.stat(entry)).exists) {
      await fs.delete(entry);
    }
    return;
  }
  await fs.createDirectory(directory);
  await fs.writeFile(entry, new TextEncoder().encode(autoStartEntry(command)));
}
