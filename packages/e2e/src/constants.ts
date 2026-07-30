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
