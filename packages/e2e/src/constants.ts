/**
 * Shared constants for E2E specs — keep hard-coded URLs here (rather than as
 * per-spec consts) so they're maintained in one place.
 */

export const SDV_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/2400";

/**
 * SDV mod whose installed file declares a file-level requirement on SMAPI
 * (mods/2400). Installed on its own (SMAPI absent) it drives a file-requirements
 * Health Check warning — the fixture for the LAZ-684 warning/install flow.
 */
export const SDV_FILE_REQUIREMENT_MOD_URL = "https://www.nexusmods.com/stardewvalley/mods/1915";
