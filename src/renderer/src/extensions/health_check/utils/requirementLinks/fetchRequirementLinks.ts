import type { CandidateRow } from "@nexusmods/file-dependency-resolver";
import { getErrorMessage, unknownToError } from "@vortex/shared";

import { isFileRequirementsAvailable } from "@/extensions/health_check/checks/fileRequirementsCheck";
import {
  resolveModRequirements,
  resolveModUID,
  resolveRequirementTarget,
} from "@/extensions/health_check/checks/modRequirementsCheck";
import { createResolverPorts } from "@/extensions/health_check/utils/fileRequirements/fileDependencyPorts";
import { resolveFileUID } from "@/extensions/health_check/utils/fileRequirements/installedFiles";
import {
  collectionManagedTags,
  isCollectionManaged,
} from "@/extensions/health_check/utils/shared/collectionManaged";
import type { IMod } from "@/extensions/mod_management/types/IMod";
import { isLoggedIn } from "@/extensions/nexus_integration/selectors";
import { nexusGamesProm } from "@/extensions/nexus_integration/util";
import { activeProfile } from "@/extensions/profile_management/selectors";
import { log } from "@/logging";
import type { IExtensionApi } from "@/types/IExtensionContext";

import {
  findRequirementLinks,
  type IFileRequirementDefinition,
  type IRequirementLink,
} from "./requirementLinks";

/**
 * The file-level requirements of the given mods' installed files, by mod id, read through the
 * file requirements health check's cache. A failed lookup leaves them out, as the mod page's
 * requirements still link without them.
 */
async function fetchFileRequirements(
  api: IExtensionApi,
  modIds: string[],
  mods: { [modId: string]: IMod },
  fileUidOf: (mod: IMod) => string | undefined,
): Promise<Map<string, IFileRequirementDefinition[]>> {
  const modIdByFileUid = new Map<string, string>();
  for (const modId of modIds) {
    const fileUid = mods[modId] !== undefined ? fileUidOf(mods[modId]) : undefined;
    if (fileUid !== undefined) {
      modIdByFileUid.set(fileUid, modId);
    }
  }
  if (modIdByFileUid.size === 0) {
    return new Map();
  }

  let rows: CandidateRow[];
  try {
    rows = await createResolverPorts(api).fetchCandidates([...modIdByFileUid.keys()]);
  } catch (err) {
    log("warn", "failed to look up file requirements to link", {
      error: getErrorMessage(unknownToError(err)),
    });
    return new Map();
  }

  // the acceptable files of each requirement of each mod
  const byMod = new Map<string, Map<string, string[]>>();
  for (const row of rows) {
    const modId = modIdByFileUid.get(row.sourceFileVersionUid);
    if (modId === undefined) {
      continue;
    }
    const definitions = byMod.get(modId) ?? new Map<string, string[]>();
    definitions.set(row.definitionId, [
      ...(definitions.get(row.definitionId) ?? []),
      row.fileVersionUid,
    ]);
    byMod.set(modId, definitions);
  }

  return new Map(
    [...byMod].map(([modId, definitions]) => [
      modId,
      [...definitions].map(([definitionId, fileUids]) => ({ definitionId, fileUids })),
    ]),
  );
}

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

  const fileUidOf = (mod: IMod) => resolveFileUID(mod.attributes ?? {}, gameId);
  const [requirements, fileRequirements] = await Promise.all([
    resolveModRequirements(api, sourceUids),
    isFileRequirementsAvailable()
      ? fetchFileRequirements(api, modIds, mods, fileUidOf)
      : new Map<string, IFileRequirementDefinition[]>(),
  ]);
  const collectionTags = collectionManagedTags(mods, profile);

  return findRequirementLinks({
    mods,
    sourceModIds: modIds,
    requirements,
    fileRequirements,
    uidOf: (mod) => resolveModUID(mod, gameId),
    fileUidOf,
    requirementUidOf: (req, sourceGameId) => resolveRequirementTarget(req, sourceGameId)?.uid,
    isCollectionManaged: (mod) => isCollectionManaged(mod, collectionTags),
    isEnabled: (modId) => profile.modState?.[modId]?.enabled === true,
    gameId,
  });
}
