/**
 * Shared constants for E2E specs — keep hard-coded URLs here (rather than as
 * per-spec consts) so they're maintained in one place.
 */

export const SDV_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/2400";

/**
 * SDV mod with a single main file that declares two file-level requirements.
 * Installed on its own (those required files absent) it drives one file-requirements
 * Health Check warning covering both — the fixture for the LAZ-684 warning/install
 * flow. Chosen to have a single main file so the download uses the main mod page
 * (the proven Mod-Manager flow), and not SMAPI, which Vortex special-cases with a
 * dedicated installer.
 */
export const SDV_FILE_REQUIREMENT_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/49786";

/**
 * The two mods whose files SDV_FILE_REQUIREMENT_MOD_URL (49786) requires: Item Bags
 * (5382) and Pokemon Eggventure - Day Care (49098). Downloading both from the website
 * is the manual flow a free user follows to satisfy the requirements and clear the
 * warning (a free user can't 1-click install). Fixture-specific — if 49786's declared
 * requirements change, update this list.
 */
export const SDV_FILE_REQUIREMENT_TARGET_URLS = [
  "https://www.nexusmods.com/stardewvalley/mods/5382",
  "https://www.nexusmods.com/stardewvalley/mods/49098",
];

/**
 * SDV mod that declares a single page-level ("mod") requirement — Generic Mod
 * Config Menu (5098), which requires SMAPI. Installed on its own (SMAPI absent) it
 * drives one blue Health Check *suggestion* ("Additional mod file may be required
 * for: …") — the mod-to-mod counterpart of SDV_FILE_REQUIREMENT_MOD_URL's
 * file-level warning. It must offer a Mod-Manager download (not manual-only) so the
 * install helper can drive it, and keep its legacy mod requirements enabled (not be
 * set to file-requirements-only) so the suggestion isn't suppressed for the
 * flag-enrolled E2E users (see LAZ-852).
 */
export const SDV_MOD_REQUIREMENT_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/5098";
