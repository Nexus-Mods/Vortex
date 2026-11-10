import type { IMod } from "../types/IMod";

// Where Nexus serves a member's avatar; a mod's own attributes only carry one for a
// collection, whose metadata comes from the API that returns it.
const memberAvatar = (memberId: number) => `https://avatars.nexusmods.com/${memberId}/100`;

/** The avatar of whoever uploaded a mod to Nexus Mods, or undefined where it isn't known. */
export const uploaderAvatar = (attributes: IMod["attributes"]): string | undefined => {
  if (attributes?.uploaderAvatar) {
    return attributes.uploaderAvatar;
  }

  return attributes?.uploaderId ? memberAvatar(attributes.uploaderId) : undefined;
};
