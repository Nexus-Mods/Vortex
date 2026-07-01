import type {
  Candidate,
  DependencyBranch,
  DependencyResult,
  FileRequirementsReport,
} from "@nexusmods/file-dependency-resolver";

import type {
  IFileLevelRequirements,
  IFileRequirement,
  IFileRequirementBranch,
  IFileRequirementCandidate,
  IFileRequirementsCheckMetadata,
  IInstalledFile,
} from "@/extensions/health_check/types";

/** Resolves an installed file's display data from its composite file UID. */
type HydrateInstalledFile = (fileUID: string) => IInstalledFile | undefined;

function toCandidate(candidate: Candidate): IFileRequirementCandidate {
  return {
    fileUID: candidate.fileVersionUid,
    modUID: candidate.modUid,
    modName: candidate.modName,
    modSummary: candidate.modSummary,
    thumbnailUrl: candidate.thumbnailUrl,
    fileName: candidate.fileName,
    version: candidate.version,
    adultContent: candidate.adultContent,
  };
}

/**
 * Classify a resolved dependency into a surfaced requirement, or undefined to drop it.
 * A multi-branch dependency is an OR; a single branch maps to a missing / wrong-version
 * kind. The UI groups the resulting kinds into report categories.
 */
function classifyDependency(
  dependency: DependencyResult,
  hydrate: HydrateInstalledFile,
): IFileRequirement | undefined {
  const { definitionId, branches } = dependency;

  // Satisfied: an acceptable version is enabled on some branch.
  if (branches.some((b) => b.satisfyingEnabled.length > 0)) {
    return undefined;
  }

  // OR: more than one alternative update group. Classify each branch to the action
  // it needs; drop branches we can't act on. An OR with no actionable branch is dropped.
  if (branches.length > 1) {
    const orBranches = branches
      .map((branch) => classifyOrBranch(branch, hydrate))
      .filter((branch): branch is IFileRequirementBranch => branch !== undefined);
    return orBranches.length > 0
      ? { kind: "or", requirementDefId: definitionId, branches: orBranches }
      : undefined;
  }

  const branch = branches[0];
  if (!branch) {
    return undefined;
  }

  // Correct version owned but disabled.
  if (branch.satisfyingDisabled.length > 0) {
    // A wrong version is enabled too: offer switching the active version.
    if (branch.wrongEnabled.length > 0) {
      const enabledFile = hydrate(branch.wrongEnabled[0]);
      const correctFile = hydrate(branch.satisfyingDisabled[0]);
      if (!enabledFile || !correctFile) {
        return undefined;
      }
      return {
        kind: "wrong-version-enabled",
        requirementDefId: definitionId,
        enabledFile,
        correctFile,
      };
    }
    // Owned-but-disabled with nothing wrong enabled is a deliberate choice.
    // TODO(future): optionally surface "enable the disabled correct version".
    return undefined;
  }

  // No acceptable version owned: download one, when the resolver found a candidate.
  if (!branch.recommended) {
    return undefined;
  }
  const candidate = toCandidate(branch.recommended);

  // A wrong version is enabled: this is a "requires a different version" download.
  if (branch.wrongEnabled.length > 0) {
    const installedFile = hydrate(branch.wrongEnabled[0]);
    if (!installedFile) {
      return undefined;
    }
    return {
      kind: "wrong-version-installed",
      requirementDefId: definitionId,
      installedFile,
      candidate,
    };
  }

  return { kind: "missing", requirementDefId: definitionId, candidate };
}

/**
 * Classify one OR alternative into the action it needs if the user picks it:
 * enable an owned-but-disabled version (switching off a wrong one if present), or
 * download the recommended file. Returns undefined when the branch isn't actionable.
 */
function classifyOrBranch(
  branch: DependencyBranch,
  hydrate: HydrateInstalledFile,
): IFileRequirementBranch | undefined {
  // Owned-but-disabled alternative: enabling it satisfies the OR without a download.
  if (branch.satisfyingDisabled.length > 0) {
    const correctFile = hydrate(branch.satisfyingDisabled[0]);
    if (!correctFile) {
      return undefined;
    }
    const enabledFile =
      branch.wrongEnabled.length > 0 ? hydrate(branch.wrongEnabled[0]) : undefined;
    return { kind: "enable", modFileId: branch.modFileId, correctFile, enabledFile };
  }

  // Otherwise offer the recommended download for this alternative.
  if (branch.recommended) {
    return {
      kind: "download",
      modFileId: branch.modFileId,
      candidate: toCandidate(branch.recommended),
    };
  }
  return undefined;
}

/**
 * Map the resolver report onto Vortex's file-requirements metadata, hydrating
 * installed files only for surfaced dependencies.
 */
export function mapRequirementsReport(
  report: FileRequirementsReport,
  hydrate: HydrateInstalledFile,
  context: { gameId: string; modsChecked: number; errors: string[] },
): IFileRequirementsCheckMetadata {
  const fileRequirements: { [fileUID: string]: IFileLevelRequirements } = {};

  for (const source of report.sources) {
    const requirements = source.dependencies
      .map((dependency) => classifyDependency(dependency, hydrate))
      .filter((requirement): requirement is IFileRequirement => requirement !== undefined);

    if (requirements.length === 0) {
      continue;
    }

    const sourceFile = hydrate(source.sourceFileVersionUid);
    fileRequirements[source.sourceFileVersionUid] = {
      sourceFileUID: source.sourceFileVersionUid,
      sourceModName: sourceFile?.modName ?? "",
      sourceModUID: sourceFile?.modUID ?? "",
      requirements,
    };
  }

  return {
    gameId: context.gameId,
    modsChecked: context.modsChecked,
    fileRequirements,
    errors: context.errors,
  };
}
