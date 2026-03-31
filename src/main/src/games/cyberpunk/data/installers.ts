export interface InstallerRule {
  id: string;
  requiredAll?: string[];
  requiredAny?: string[];
  pathPrefixes?: string[];
  extensions?: string[];
}

export const ARCHIVE_PREFIX = "archive\\pc\\mod";
export const HERITAGE_ARCHIVE_PREFIX = "archive\\pc\\patch";
export const REDMOD_BASEDIR = "mods";
export const CET_PREFIX = "bin\\x64\\plugins\\cyber_engine_tweaks\\mods";
export const AMM_PREFIX =
  "bin\\x64\\plugins\\cyber_engine_tweaks\\mods\\AppearanceMenuMod";
export const RED4EXT_PREFIX = "red4ext";
export const RED4EXT_PLUGIN_PREFIX = "red4ext\\plugins";
export const REDSCRIPT_PREFIX = "r6\\scripts";
export const REDSCRIPT_HINTS_PREFIX = "r6\\config\\redsUserHints";
export const TWEAK_XL_PREFIX = "r6\\tweaks";
export const AUDIOWARE_PREFIX = "r6\\audioware";
export const ASI_PREFIX = "bin\\x64\\plugins";
export const PRESET_UNLOCKER_PREFIX =
  "bin\\x64\\plugins\\cyber_engine_tweaks\\mods\\AppearanceChangeUnlocker\\character-presets";
export const PRESET_CYBERCAT_PREFIX = "V2077\\presets\\cybercat";

export const CORE_CET_RULE: InstallerRule = {
  id: "core-cet",
  requiredAll: [
    "bin\\x64\\plugins\\cyber_engine_tweaks\\cyber_engine_tweaks.asi",
    "bin\\x64\\plugins\\cyber_engine_tweaks\\global.ini",
    "bin\\x64\\plugins\\cyber_engine_tweaks\\LICENSE",
  ],
};

export const CORE_REDSCRIPT_RULE: InstallerRule = {
  id: "core-redscript",
  requiredAny: [
    "engine\\config\\base\\scripts.ini",
    "engine\\tools\\scc.exe",
    "r6\\config\\cybercmd\\scc.toml",
    "r6\\scripts\\redscript.toml",
  ],
};

export const CORE_RED4EXT_RULE: InstallerRule = {
  id: "core-red4ext",
  requiredAll: [
    "red4ext\\RED4ext.dll",
  ],
  requiredAny: [
    "bin\\x64\\winmm.dll",
    "bin\\x64\\d3d11.dll",
    "bin\\x64\\powrprof.dll",
  ],
};

export const CORE_INPUT_LOADER_RULE: InstallerRule = {
  id: "core-input-loader",
  requiredAll: [
    "engine\\config\\platform\\pc\\input_loader.ini",
    "red4ext\\plugins\\input_loader\\input_loader.dll",
  ],
};

export const CORE_MOD_SETTINGS_RULE: InstallerRule = {
  id: "core-mod-settings",
  requiredAll: [
    "red4ext\\plugins\\mod_settings\\mod_settings.dll",
    "red4ext\\plugins\\mod_settings\\ModSettings.archive",
  ],
};

export const CORE_TWEAK_XL_RULE: InstallerRule = {
  id: "core-tweakxl",
  requiredAll: [
    "red4ext\\plugins\\TweakXL\\TweakXL.dll",
    "red4ext\\plugins\\TweakXL\\Scripts\\TweakXL.reds",
  ],
};

export const CORE_AUDIOWARE_RULE: InstallerRule = {
  id: "core-audioware",
  requiredAll: [
    "red4ext\\plugins\\audioware\\audioware.dll",
    "r6\\scripts\\Audioware\\Codeware.reds",
  ],
};

export const CORE_ARCHIVEXL_RULE: InstallerRule = {
  id: "core-archivexl",
  requiredAll: [
    "red4ext\\plugins\\ArchiveXL\\ArchiveXL.dll",
    "red4ext\\plugins\\ArchiveXL\\Scripts\\ArchiveXL.reds",
  ],
};

export const CORE_AMM_RULE: InstallerRule = {
  id: "core-amm",
  requiredAll: [
    "bin\\x64\\plugins\\cyber_engine_tweaks\\mods\\AppearanceMenuMod\\init.lua",
    "archive\\pc\\mod\\basegame_AMM_Props.archive",
  ],
};

export const CORE_CYBERSCRIPT_RULE: InstallerRule = {
  id: "core-cyberscript",
  requiredAll: [
    "bin\\x64\\plugins\\ImmersiveRoleplayFramework.asi",
    "bin\\x64\\plugins\\cyber_engine_tweaks\\mods\\quest_mod\\init.lua",
  ],
};

export const CORE_CYBERCAT_RULE: InstallerRule = {
  id: "core-cybercat",
  requiredAll: [
    "CyberCAT\\config.json",
    "CyberCAT\\CP2077SaveEditor.exe",
  ],
};

export const SPECIALIZED_RULES: InstallerRule[] = [
  CORE_CET_RULE,
  CORE_REDSCRIPT_RULE,
  CORE_RED4EXT_RULE,
  CORE_AUDIOWARE_RULE,
  CORE_TWEAK_XL_RULE,
  CORE_ARCHIVEXL_RULE,
  CORE_INPUT_LOADER_RULE,
  CORE_MOD_SETTINGS_RULE,
  CORE_CYBERCAT_RULE,
  CORE_AMM_RULE,
  CORE_CYBERSCRIPT_RULE,
  { id: "amm", pathPrefixes: [AMM_PREFIX, "Collabs", "User"] },
  { id: "cet", pathPrefixes: [CET_PREFIX] },
  { id: "redscript", pathPrefixes: [REDSCRIPT_PREFIX, REDSCRIPT_HINTS_PREFIX] },
  { id: "red4ext", pathPrefixes: [RED4EXT_PLUGIN_PREFIX], extensions: [".dll"] },
  { id: "tweakxl", pathPrefixes: [TWEAK_XL_PREFIX], extensions: [".yaml", ".yml"] },
  { id: "audioware", pathPrefixes: [AUDIOWARE_PREFIX], extensions: [".yaml", ".yml", ".wav", ".ogg", ".mp3", ".flac"] },
  { id: "asi", pathPrefixes: [ASI_PREFIX], extensions: [".asi"] },
  { id: "config-xml", pathPrefixes: ["r6\\config", "r6\\input"], extensions: [".xml"] },
  { id: "config-json", extensions: [".json"] },
  { id: "config-ini", pathPrefixes: ["engine\\config\\platform\\pc", "bin\\x64"], extensions: [".ini"] },
  { id: "preset", extensions: [".preset"] },
  { id: "archive", pathPrefixes: [ARCHIVE_PREFIX, HERITAGE_ARCHIVE_PREFIX], extensions: [".archive", ".xl"] },
];
