import { FileSourceKind, pathKeyOf, sameOrigin, type Lockfile } from "@nexusmods/mod-pipeline";
import type { ManifestDiff, ManifestDiffReason } from "@vortex/nexus-api-v3";
import { getErrorMessageOrDefault, type VortexGameId } from "@vortex/shared";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { diffActivation, type IDeployment } from "../LinkingDeployment";
import { deployedFilePath } from "./deployedFilePath";
import { gatherDeployed, type DeployedOrigin, type ManifestFiles } from "./resolverInput";

/** Why one destination differs between the resolver's lockfile and what a deployment wrote. */
export const ReasonCode = {
  /** the deployment wrote a file the lockfile does not list */
  MissingFromLockfile: "missing-from-lockfile",
  /** the lockfile lists a file the deployment did not write */
  MissingFromDeploy: "missing-from-deploy",
  /** both have the destination, from different origins */
  DifferentWinner: "different-winner",
} as const satisfies Record<string, ManifestDiffReason>;
export type ReasonCode = (typeof ReasonCode)[keyof typeof ReasonCode];

const byKey = <Destination extends { destinationPath: string }>(
  destinations: readonly Destination[],
) =>
  new Map(destinations.map((destination) => [pathKeyOf(destination.destinationPath), destination]));

const noMismatches = (): ManifestDiff["counts"] => ({
  [ReasonCode.MissingFromLockfile]: 0,
  [ReasonCode.MissingFromDeploy]: 0,
  [ReasonCode.DifferentWinner]: 0,
});

const diffOf = (counts: ManifestDiff["counts"]): ManifestDiff => ({
  verdict: Object.values(counts).every((count) => count === 0) ? "pass" : "fail",
  counts,
});

/** Counts how the lockfile's mod files differ from a deployment's, by destination and origin. */
export function compareWithDeployment(
  lockfile: Lockfile,
  deployed: readonly DeployedOrigin[],
): ManifestDiff {
  const counts = noMismatches();
  const lockfileFiles = byKey(
    lockfile.files.filter((file) => file.source !== FileSourceKind.VortexGenerated),
  );
  const deployedFiles = byKey(deployed);
  for (const [key, file] of lockfileFiles) {
    const deployedFile = deployedFiles.get(key);
    if (deployedFile === undefined) {
      counts[ReasonCode.MissingFromDeploy] += 1;
    } else if (!sameOrigin(file, deployedFile)) {
      counts[ReasonCode.DifferentWinner] += 1;
    }
  }
  for (const key of deployedFiles.keys()) {
    if (!lockfileFiles.has(key)) {
      counts[ReasonCode.MissingFromLockfile] += 1;
    }
  }
  return diffOf(counts);
}

/** Each manifest entry by its mod type and the path it deploys to below that type's folder. */
const byTypeAndPath = (entries: ManifestFiles): IDeployment =>
  Object.fromEntries(
    [...entries].flatMap(([typeId, files]) =>
      files.map((file) => [
        `${typeId}\u0000${deployedFilePath("", file.target, file.relPath)}`,
        file,
      ]),
    ),
  );

/**
 * Counts how the manifest entries a plan's operations leave differ from the ones its deployment
 * saved, by mod type and deployed path. An entry with another time counts as missing on both sides.
 */
export function compareManifestFiles(
  plannedEntries: ManifestFiles,
  deployedEntries: ManifestFiles,
): ManifestDiff {
  const { added, removed, sourceChanged, contentChanged } = diffActivation(
    byTypeAndPath(deployedEntries),
    byTypeAndPath(plannedEntries),
  );
  return diffOf({
    [ReasonCode.MissingFromLockfile]: removed.length + contentChanged.length,
    [ReasonCode.MissingFromDeploy]: added.length + contentChanged.length,
    [ReasonCode.DifferentWinner]: sourceChanged.length,
  });
}

/**
 * Compares a lockfile, and the manifest entries its plan's operations leave, with the manifests its
 * deployment saved, and logs both results. Both are null when either side can't be read.
 */
export async function compareWithManifests(
  api: IExtensionApi,
  gameMode: VortexGameId,
  lockfile: Lockfile,
  plannedEntries: () => Promise<ManifestFiles>,
): Promise<{ manifestDiff: ManifestDiff | null; manifestEntryDiff: ManifestDiff | null }> {
  try {
    const { origins, manifestFiles } = await gatherDeployed(api, gameMode);
    const manifestDiff = compareWithDeployment(lockfile, origins);
    log("info", "shadow comparison", {
      gameMode,
      verdict: manifestDiff.verdict,
      ...manifestDiff.counts,
    });
    const manifestEntryDiff = compareManifestFiles(await plannedEntries(), manifestFiles);
    log("info", "manifest comparison", {
      gameMode,
      verdict: manifestEntryDiff.verdict,
      ...manifestEntryDiff.counts,
    });
    return { manifestDiff, manifestEntryDiff };
  } catch (err) {
    log("warn", "failed to compare with the deployment", {
      gameMode,
      error: getErrorMessageOrDefault(err),
    });
    return { manifestDiff: null, manifestEntryDiff: null };
  }
}
