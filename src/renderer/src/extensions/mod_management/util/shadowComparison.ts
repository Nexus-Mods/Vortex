import { FileSourceKind, pathKeyOf, sameOrigin, type Lockfile } from "@nexusmods/mod-pipeline";
import type { ManifestDiff, ManifestDiffReason } from "@vortex/nexus-api-v3";

import type { DeployedOrigin } from "./resolverInput";

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

/** Counts how the lockfile's mod files differ from a deployment's, by destination and origin. */
export function compareWithDeployment(
  lockfile: Lockfile,
  deployed: readonly DeployedOrigin[],
): ManifestDiff {
  const counts: ManifestDiff["counts"] = {
    [ReasonCode.MissingFromLockfile]: 0,
    [ReasonCode.MissingFromDeploy]: 0,
    [ReasonCode.DifferentWinner]: 0,
  };
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
  return {
    verdict: Object.values(counts).every((count) => count === 0) ? "pass" : "fail",
    counts,
  };
}
