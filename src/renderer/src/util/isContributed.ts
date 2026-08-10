import { COMPANY_ID, NEXUSMODS_EXT_ID } from "./constants";

// Lives here rather than in the extension manager util, which is mid-rework.
// TODO: adopt this in ExtensionManager's two `author !== COMPANY_ID` checks and
// move it into the extension manager util.

const OFFICIAL_AUTHORS = [COMPANY_ID, NEXUSMODS_EXT_ID];

// True when the extension is community-contributed rather than official.
// First-party authors (Nexus Mods / Black Tree Gaming Ltd.) and empty values
// are treated as official.
export function isContributed(author: string | undefined): boolean {
  return !!author && !OFFICIAL_AUTHORS.includes(author);
}
