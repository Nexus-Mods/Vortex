/**
 * Integration constants for external Stardew/SMAPI services.
 */
/** SMAPI compatibility query interval (once per week). */
export const SMAPI_QUERY_FREQUENCY: number = 1000 * 60 * 24 * 7;

/** SMAPI.io API version used for compatibility lookups. */
export const SMAPI_IO_API_VERSION = '3.0.0';

/** Nexus mod id for the SMAPI package. */
export const SMAPI_MOD_ID = 2400;

/** Public Nexus page for SMAPI downloads. */
export const SMAPI_URL = `https://www.nexusmods.com/stardewvalley/mods/${SMAPI_MOD_ID}`;
