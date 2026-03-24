/**
 * Test data for the SMAPI installer.
 *
 * These lists match the files in the main archive and in each platform's
 * `install.dat` file. The helpers turn those lists into the shapes the tests
 * need.
 */
import path from "path";

/**
 * Files in the main SMAPI 4.5.1 installer archive.
 *
 * The sample was captured from
 * `/home/sewer/Downloads/temp/SMAPI 4.5.1 installer`.
 */
export const smapiInstallerArchiveEntries: string[] = [
  "README.txt",
  "install on Linux.sh",
  "install on macOS.command",
  "install on Windows.bat",
  "internal/windows/install.dat",
  "internal/linux/install.dat",
  "internal/macOS/install.dat",
  "internal/windows/SMAPI.Installer.dll",
  "internal/linux/SMAPI.Installer.dll",
  "internal/macOS/SMAPI.Installer.dll",
];

/**
 * Files in the Windows `install.dat` payload.
 */
export const windowsInstallDatEntries: string[] = [
  "Mods/",
  "Mods/ConsoleCommands/",
  "Mods/ConsoleCommands/manifest.json",
  "Mods/ConsoleCommands/ConsoleCommands.dll",
  "Mods/SaveBackup/",
  "Mods/SaveBackup/SaveBackup.dll",
  "Mods/SaveBackup/manifest.json",
  "smapi-internal/",
  "smapi-internal/Pintail.dll",
  "smapi-internal/metadata.json",
  "smapi-internal/config.json",
  "smapi-internal/SMAPI.Toolkit.CoreInterfaces.dll",
  "smapi-internal/Mono.Cecil.dll",
  "smapi-internal/blacklist.json",
  "smapi-internal/SMAPI.Toolkit.dll",
  "smapi-internal/Mono.Cecil.Pdb.dll",
  "smapi-internal/SMAPI.Toolkit.xml",
  "smapi-internal/Pathoschild.Http.Client.dll",
  "smapi-internal/Mono.Cecil.Mdb.dll",
  "smapi-internal/Newtonsoft.Json.dll",
  "smapi-internal/0Harmony.dll",
  "smapi-internal/TMXTile.dll",
  "smapi-internal/Markdig.dll",
  "smapi-internal/0Harmony.xml",
  "smapi-internal/i18n/",
  "smapi-internal/i18n/pt.json",
  "smapi-internal/i18n/id.json",
  "smapi-internal/i18n/uk.json",
  "smapi-internal/i18n/it.json",
  "smapi-internal/i18n/fr.json",
  "smapi-internal/i18n/zh.json",
  "smapi-internal/i18n/tr.json",
  "smapi-internal/i18n/ko.json",
  "smapi-internal/i18n/de.json",
  "smapi-internal/i18n/ru.json",
  "smapi-internal/i18n/pl.json",
  "smapi-internal/i18n/hu.json",
  "smapi-internal/i18n/th.json",
  "smapi-internal/i18n/es.json",
  "smapi-internal/i18n/default.json",
  "smapi-internal/i18n/ja.json",
  "smapi-internal/System.Net.Http.Formatting.dll",
  "smapi-internal/SMAPI.Toolkit.CoreInterfaces.xml",
  "smapi-internal/VdfConverter.dll",
  "smapi-internal/MonoMod.Common.dll",
  "StardewModdingAPI.dll",
  "StardewModdingAPI.exe",
  "StardewModdingAPI.exe.config",
  "StardewModdingAPI.runtimeconfig.json",
  "StardewModdingAPI.xml",
  "steam_appid.txt",
];

/**
 * Files in the Linux `install.dat` payload.
 */
export const linuxInstallDatEntries: string[] = [
  "Mods/",
  "Mods/ConsoleCommands/",
  "Mods/ConsoleCommands/manifest.json",
  "Mods/ConsoleCommands/ConsoleCommands.dll",
  "Mods/SaveBackup/",
  "Mods/SaveBackup/SaveBackup.dll",
  "Mods/SaveBackup/manifest.json",
  "smapi-internal/",
  "smapi-internal/Pintail.dll",
  "smapi-internal/metadata.json",
  "smapi-internal/config.json",
  "smapi-internal/SMAPI.Toolkit.CoreInterfaces.dll",
  "smapi-internal/Mono.Cecil.dll",
  "smapi-internal/blacklist.json",
  "smapi-internal/SMAPI.Toolkit.dll",
  "smapi-internal/Mono.Cecil.Pdb.dll",
  "smapi-internal/SMAPI.Toolkit.xml",
  "smapi-internal/Pathoschild.Http.Client.dll",
  "smapi-internal/Mono.Cecil.Mdb.dll",
  "smapi-internal/Newtonsoft.Json.dll",
  "smapi-internal/0Harmony.dll",
  "smapi-internal/TMXTile.dll",
  "smapi-internal/Markdig.dll",
  "smapi-internal/0Harmony.xml",
  "smapi-internal/i18n/",
  "smapi-internal/i18n/pt.json",
  "smapi-internal/i18n/id.json",
  "smapi-internal/i18n/uk.json",
  "smapi-internal/i18n/it.json",
  "smapi-internal/i18n/fr.json",
  "smapi-internal/i18n/zh.json",
  "smapi-internal/i18n/tr.json",
  "smapi-internal/i18n/ko.json",
  "smapi-internal/i18n/de.json",
  "smapi-internal/i18n/ru.json",
  "smapi-internal/i18n/pl.json",
  "smapi-internal/i18n/hu.json",
  "smapi-internal/i18n/th.json",
  "smapi-internal/i18n/es.json",
  "smapi-internal/i18n/default.json",
  "smapi-internal/i18n/ja.json",
  "smapi-internal/System.Net.Http.Formatting.dll",
  "smapi-internal/SMAPI.Toolkit.CoreInterfaces.xml",
  "smapi-internal/MonoMod.Common.dll",
  "StardewModdingAPI",
  "StardewModdingAPI.dll",
  "StardewModdingAPI.runtimeconfig.json",
  "StardewModdingAPI.xml",
  "steam_appid.txt",
  "unix-launcher.sh",
];

/**
 * Files in the macOS `install.dat` payload.
 */
export const macosInstallDatEntries: string[] = [
  "Mods/",
  "Mods/ConsoleCommands/",
  "Mods/ConsoleCommands/manifest.json",
  "Mods/ConsoleCommands/ConsoleCommands.dll",
  "Mods/SaveBackup/",
  "Mods/SaveBackup/SaveBackup.dll",
  "Mods/SaveBackup/manifest.json",
  "smapi-internal/",
  "smapi-internal/Pintail.dll",
  "smapi-internal/metadata.json",
  "smapi-internal/config.json",
  "smapi-internal/SMAPI.Toolkit.CoreInterfaces.dll",
  "smapi-internal/Mono.Cecil.dll",
  "smapi-internal/blacklist.json",
  "smapi-internal/SMAPI.Toolkit.dll",
  "smapi-internal/Mono.Cecil.Pdb.dll",
  "smapi-internal/SMAPI.Toolkit.xml",
  "smapi-internal/Pathoschild.Http.Client.dll",
  "smapi-internal/Mono.Cecil.Mdb.dll",
  "smapi-internal/Newtonsoft.Json.dll",
  "smapi-internal/0Harmony.dll",
  "smapi-internal/TMXTile.dll",
  "smapi-internal/Markdig.dll",
  "smapi-internal/0Harmony.xml",
  "smapi-internal/i18n/",
  "smapi-internal/i18n/pt.json",
  "smapi-internal/i18n/id.json",
  "smapi-internal/i18n/uk.json",
  "smapi-internal/i18n/it.json",
  "smapi-internal/i18n/fr.json",
  "smapi-internal/i18n/zh.json",
  "smapi-internal/i18n/tr.json",
  "smapi-internal/i18n/ko.json",
  "smapi-internal/i18n/de.json",
  "smapi-internal/i18n/ru.json",
  "smapi-internal/i18n/pl.json",
  "smapi-internal/i18n/hu.json",
  "smapi-internal/i18n/th.json",
  "smapi-internal/i18n/es.json",
  "smapi-internal/i18n/default.json",
  "smapi-internal/i18n/ja.json",
  "smapi-internal/System.Net.Http.Formatting.dll",
  "smapi-internal/SMAPI.Toolkit.CoreInterfaces.xml",
  "smapi-internal/MonoMod.Common.dll",
  "StardewModdingAPI",
  "StardewModdingAPI.dll",
  "StardewModdingAPI.runtimeconfig.json",
  "StardewModdingAPI.xml",
  "steam_appid.txt",
  "unix-launcher.sh",
];

/**
 * Removes directory entries from an archive listing.
 *
 * @param entries Archive listing that may include paths ending with `/`.
 * @returns Only the file paths.
 */
export function archiveFileEntries(entries: string[]): string[] {
  return entries.filter((entry) => !entry.endsWith("/"));
}

type IWalkCallback = (
  iter: string,
  stats: { isFile: () => boolean },
) => Promise<void>;

/**
 * Calls a `util.walk`-style callback for each archive entry.
 *
 * @param destinationPath Root path used to build each full entry path.
 * @param archiveEntries Archive listing with `/`-separated relative paths.
 * @param callback Async callback that receives the full path and a small stats
 * object.
 * @returns A promise that resolves after every entry has been passed to
 * `callback`.
 * @throws Re-throws any error from `callback`.
 */
export async function walkArchiveEntries(
  destinationPath: string,
  archiveEntries: string[],
  callback: IWalkCallback,
): Promise<void> {
  for (const entry of archiveEntries) {
    const isFile = !entry.endsWith("/");
    const relPath = entry.endsWith("/") ? entry.slice(0, -1) : entry;
    const absolutePath = path.join(destinationPath, ...relPath.split("/"));
    await callback(absolutePath, { isFile: () => isFile });
  }
}
