export const MOD_TYPE = "collection";
export const NAMESPACE = "collection";
export const AUTHOR_UNKNOWN = "<Unknown User>";
export const AVATAR_FALLBACK = "assets/images/noavatar.png";

export const NEXUS_DOMAIN = process.env["NEXUS_DOMAIN"] || "nexusmods.com";
export const NEXUS_FLAMEWORK_SUBDOMAIN =
  process.env["FLAMEWORK_SUBDOMAIN"] || "www";
export const NEXUS_NEXT_SUBDOMAIN = process.env["NEXT_SUBDOMAIN"] || "next";

export const NEXUS_BASE_URL =
  process.env["NEXUS_BASE_URL"] ||
  `https://${NEXUS_FLAMEWORK_SUBDOMAIN}.${NEXUS_DOMAIN}`;
export const NEXUS_GAMES_URL =
  process.env["NEXUS_GAMES_URL"] || `https://${NEXUS_DOMAIN}/games`;
export const NEXUS_BASE_GAMES_URL =
  process.env["NEXUS_BASE_GAMES_URL"] ||
  `https://${NEXUS_FLAMEWORK_SUBDOMAIN}.${NEXUS_DOMAIN}/games`;
export const NEXUS_PROTOCOL = "https:";

export const PREMIUM_PATH = ["account", "billing", "premium"];

export const TOS_URL =
  "https://help.nexusmods.com/article/115-guidelines-for-collections";
export const ADULT_CONTENT_URL =
  "https://help.nexusmods.com/article/19-adult-content-guidelines";

export const BUNDLED_PATH = "bundled";
export const PATCHES_PATH = "patches";

export const INSTALLING_NOTIFICATION_ID = "installing-collection-";

// limits
export const MIN_COLLECTION_NAME_LENGTH = 3;
export const MAX_COLLECTION_NAME_LENGTH = 64;

export const INI_TWEAKS_PATH = "Ini Tweaks";

// Although the required property has been removed,
//  we're keeping this for backwards compatibility as
//  some released collections could still have it.
export const OPTIONAL_TWEAK_PREFIX = "(optional).";

// time after installing a revision before we ask for a vote. in milliseconds
export const TIME_BEFORE_VOTE = 48 * 60 * 60 * 1000;
// upon start, time before we first check whether a revision needs to be rated. in milliseconds
export const DELAY_FIRST_VOTE_REQUEST = 1 * 60 * 1000;

export const MAX_PATCH_SIZE = 0.2;
// the patch overhead depends on how many locations were changed, this very roughly accounts for
// the overhead we would see for a diff containing a single change.
// This is to prevent the patch size limit from making binary patches to very small files
// impossible
export const PATCH_OVERHEAD = 130;

// how long we buffer collection/revision info from the api
export const CACHE_EXPIRE_MS = 1 * 60 * 60 * 1000;

// number of revision (and collection) info items we keep at most
export const CACHE_LRU_COUNT = 50;

export const DEFAULT_INSTRUCTIONS = "No additional instructions.";
export const INSTRUCTIONS_PLACEHOLDER =
  "Enter instructions here (Markdown supported - Links, Bold, Italics)";
