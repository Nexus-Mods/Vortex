export const SDV_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/2400";

/**
 * Vintage Interface v2 — a CP content pack that visibly reskins the UI. The
 * target mod for the uninstall/disable specs: installs cleanly alongside SMAPI
 * and its deployed files are easy to assert on in the game's Mods folder.
 */
export const SDV_VINTAGE_INTERFACE_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/4697";

export const SDV_FILE_REQUIREMENT_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/49786";
export const SDV_FILE_REQUIREMENT_TARGET_URLS = [
  "https://www.nexusmods.com/stardewvalley/mods/5382",
  "https://www.nexusmods.com/stardewvalley/mods/49098",
];
// Free users are sent to the required file on the mod's Files tab
// (`?tab=files&file_id=<id>&nmm=1`); the bare mod page is also accepted.
export const SDV_FILE_REQUIREMENT_TARGET_URL_PATTERN =
  /nexusmods\.com\/stardewvalley\/mods\/(5382|49098)(\?tab=files&file_id=\d+&nmm=1)?$/;
export const SDV_OR_FILE_REQUIREMENT_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/47938";
export const SDV_MOD_REQUIREMENT_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/5098";
