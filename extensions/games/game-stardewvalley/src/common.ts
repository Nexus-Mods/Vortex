/**
 * Cross-module constants used by the Stardew Valley extension.
 *
 * Keep values here stable so installer, runtime, and UI modules share the same
 * identifiers for game IDs, file names, and mod types.
 */
export const GAME_ID = 'stardewvalley';
export const MOD_CONFIG = 'config.json';
export const MOD_MANIFEST = 'manifest.json';
export const RGX_INVALID_CHARS_WINDOWS = /[:/\\*?"<>|]/g;

// Mod type identifiers registered with Vortex.
export const MOD_TYPE_SMAPI = 'SMAPI';
export const MOD_TYPE_CONFIG = 'sdv-configuration-mod';
export const MOD_TYPE_ROOT = 'sdvrootfolder';

// Installer identifiers registered with Vortex.
export const INSTALLER_ID_SMAPI = 'smapi-installer';
export const INSTALLER_ID_ROOT = 'sdvrootfolder';
export const INSTALLER_ID_MANIFEST = 'stardew-valley-installer';

// Installer priorities. Higher priority wins installer selection when multiple
// tests support an archive.
export const INSTALLER_PRIORITY_SMAPI = 30;
export const INSTALLER_PRIORITY_ROOT = 50;
export const INSTALLER_PRIORITY_MANIFEST = 50;

// Mod type priorities used during mod type detection.
export const MOD_TYPE_PRIORITY_SMAPI = 30;
export const MOD_TYPE_PRIORITY_CONFIG = 30;
export const MOD_TYPE_PRIORITY_ROOT = 25;

export const SMAPI_INTERNAL_DIRECTORY = 'smapi-internal';

export const _SMAPI_BUNDLED_MODS = ['ErrorHandler', 'ConsoleCommands', 'SaveBackup'];

export const NOTIF_ACTIVITY_CONFIG_MOD = 'sdv-config-mod-activity';

export const getBundledMods = () => {
  return Array.from(new Set(_SMAPI_BUNDLED_MODS.map(modName => modName.toLowerCase())));
}
