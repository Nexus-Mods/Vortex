import { VortexGameId } from "@vortex/shared";

/** The site's id: a Nexus domain to some callers, and a Vortex game id to others. */
export const SITE_ID = "site";
/** The site as the Vortex game that extensions and site mods are kept under. */
export const SITE_GAME_ID = VortexGameId(SITE_ID);
