import {
  resolveModRequirements,
  resolveModUID,
  resolveRequirementTarget,
} from "@/extensions/health_check/checks/modRequirementsCheck";
import {
  collectionManagedTags,
  isCollectionManaged,
} from "@/extensions/health_check/utils/shared/collectionManaged";
import { isLoggedIn } from "@/extensions/nexus_integration/selectors";
import { nexusGamesProm } from "@/extensions/nexus_integration/util";
import { activeProfile } from "@/extensions/profile_management/selectors";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { findRequirementLinks, type IRequirementLink } from "./requirementLinks";

/** Why there's nothing to link, when it isn't that every requirement is linked already. */
export type RequirementLinksUnavailable = "no-profile" | "logged-out";

/**
 * The unlinked Nexus requirements of the given mods that installed mods satisfy, read through
 * the requirements health check's cache.
 */
export async function fetchRequirementLinks(
  api: IExtensionApi,
  modIds: string[],
): Promise<IRequirementLink[] | RequirementLinksUnavailable> {
  const state = api.getState();
  const profile = activeProfile(state);
  if (profile?.gameId === undefined) {
    return "no-profile";
  }
  if (!isLoggedIn(state)) {
    return "logged-out";
  }

  // makeModUID needs the nexus games list to map a game domain to its numeric id
  await nexusGamesProm();

  const { gameId } = profile;
  const mods = state.persistent.mods[gameId] ?? {};
  const sourceUids = modIds
    .map((modId) => mods[modId])
    .filter((mod) => mod !== undefined)
    .map((mod) => resolveModUID(mod, gameId))
    .filter((uid) => uid !== undefined);

  const requirements = await resolveModRequirements(api, sourceUids);
  const collectionTags = collectionManagedTags(mods, profile);

  return findRequirementLinks({
    mods,
    sourceModIds: modIds,
    requirements,
    uidOf: (mod) => resolveModUID(mod, gameId),
    requirementUidOf: (req, sourceGameId) => resolveRequirementTarget(req, sourceGameId)?.uid,
    isCollectionManaged: (mod) => isCollectionManaged(mod, collectionTags),
    isEnabled: (modId) => profile.modState?.[modId]?.enabled === true,
    gameId,
  });
}
