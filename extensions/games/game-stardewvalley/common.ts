export const GAME_ID = 'stardewvalley';
export const MOD_CONFIG = 'config.json';
export const MOD_MANIFEST = 'manifest.json';
export const RGX_INVALID_CHARS_WINDOWS = /[:/\\*?"<>|]/g;
export const MOD_TYPE_CONFIG = 'sdv-configuration-mod';

export const SMAPI_INTERNAL_DIRECTORY = 'smapi-internal';

export const _SMAPI_BUNDLED_MODS = ['ErrorHandler', 'ConsoleCommands', 'SaveBackup'];

export const NOTIF_ACTIVITY_CONFIG_MOD = 'sdv-config-mod-activity';

export const getBundledMods = () => {
  return Array.from(new Set(_SMAPI_BUNDLED_MODS.map(modName => modName.toLowerCase())));
}