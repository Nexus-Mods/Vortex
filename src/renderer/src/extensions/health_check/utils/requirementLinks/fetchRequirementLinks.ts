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
  findMissingRequirements,
  findRequirementLinks,
  type IFileRequirementDefinition,
  type IFindRequirementLinksInput,
  type IMissingRequirement,
  type IRequirementFile,
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
  const byMod = new Map<string, Map<string, IRequirementFile[]>>();
  for (const row of rows) {
    const modId = modIdByFileUid.get(row.sourceFileVersionUid);
    if (modId === undefined) {
      continue;
    }
    const definitions = byMod.get(modId) ?? new Map<string, IRequirementFile[]>();
    const file = {
      fileUid: row.fileVersionUid,
      modUid: row.modUid,
      position: Number(row.position),
    };
    definitions.set(row.definitionId, [...(definitions.get(row.definitionId) ?? []), file]);
    byMod.set(modId, definitions);
  }

  const result = new Map(
    [...byMod].map(([modId, definitions]): [string, IFileRequirementDefinition[]] => [
      modId,
      [...definitions].map(([definitionId, files]) => ({ definitionId, files })),
    ]),
  );
  await describeUnmetFiles(api, result, mods, fileUidOf);
  return result;
}

/**
 * Fills in the names and versions of the acceptable files of the requirements nothing installed
 * satisfies, which are shown as not installed or as the wrong version; those of the rest aren't
 * needed. Display data only, so a failed lookup leaves them out.
 */
async function describeUnmetFiles(
  api: IExtensionApi,
  fileRequirements: Map<string, IFileRequirementDefinition[]>,
  mods: { [modId: string]: IMod },
  fileUidOf: (mod: IMod) => string | undefined,
): Promise<void> {
  const installed = new Set(Object.values(mods).map(fileUidOf));
  const unmet = [...fileRequirements.values()]
    .flat()
    .filter((definition) => !definition.files.some((file) => installed.has(file.fileUid)))
    .flatMap((definition) => definition.files);
  if (unmet.length === 0) {
    return;
  }

  try {
    const ports = createResolverPorts(api);
    const [details, modDetails] = await Promise.all([
      ports.fetchFileVersionDetails([...new Set(unmet.map((file) => file.fileUid))]),
      ports.fetchModDetails([...new Set(unmet.map((file) => file.modUid))]),
    ]);
    const detailOf = new Map(details.map((detail) => [detail.fileVersionUid, detail]));
    const modNameOf = new Map(modDetails.map((detail) => [detail.modUid, detail.name]));
    for (const file of unmet) {
      file.fileName = detailOf.get(file.fileUid)?.name;
      file.version = detailOf.get(file.fileUid)?.version;
      file.modName = modNameOf.get(file.modUid);
    }
  } catch (err) {
    log("warn", "failed to look up the files of missing requirements", {
      error: getErrorMessage(unknownToError(err)),
    });
  }
}

/** Why the requirements couldn't be looked up. */
export type RequirementLinksUnavailable = "no-profile" | "logged-out";

/** The given mods' Nexus requirements: those to link, and those nothing installed satisfies. */
export interface IRequirementLinksOffer {
  links: IRequirementLink[];
  missing: IMissingRequirement[];
}

/**
 * The Nexus requirements of the given mods: those installed mods satisfy, linked or not, and those
 * nothing installed does. Read through the requirements health checks' caches.
 */
export async function fetchRequirementLinks(
  api: IExtensionApi,
  modIds: string[],
): Promise<IRequirementLinksOffer | RequirementLinksUnavailable> {
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

  const input: IFindRequirementLinksInput = {
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
  };
  return { links: findRequirementLinks(input), missing: findMissingRequirements(input) };
}
