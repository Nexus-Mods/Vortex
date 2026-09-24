import { COMPANY_ID, NEXUSMODS_EXT_ID } from "./constants";

// Lives here rather than in the extension manager util, which is mid-rework.
// TODO: adopt this in ExtensionManager's two `author !== COMPANY_ID` checks and
// move it into the extension manager util.

// Extensions spell us both ways ("Nexus Mods", "NexusMods"), so names are compared without
// spacing or case - but still whole, so a contributor who merely has "Nexus" in their name
// stays community.
const normalise = (name: string) => name.replace(/\s+/g, "").toLowerCase();

const OFFICIAL_AUTHORS = new Set([COMPANY_ID, NEXUSMODS_EXT_ID].map(normalise));

// True when the extension is community-contributed rather than official.
// First-party authors (Nexus Mods / Black Tree Gaming Ltd.) and empty values
// are treated as official.
export function isContributed(author: string | undefined): boolean {
  return !!author && !OFFICIAL_AUTHORS.has(normalise(author));
}
