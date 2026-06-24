import type {
  Candidate,
  DependencyResult,
  FileRequirementsReport,
} from "@nexusmods/file-dependency-resolver";

import type {
  IFileLevelRequirements,
  IFileRequirement,
  IFileRequirementCandidate,
  IFileRequirementsCheckMetadata,
  IInstalledFile,
} from "@/extensions/health_check/types";

/** Resolves an installed file's display data from its composite file UID. */
type HydrateInstalledFile = (fileUID: string) => IInstalledFile | undefined;

function toCandidate(candidate: Candidate): IFileRequirementCandidate {
  return {
    fileUID: candidate.fileVersionUid,
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
 */
function classifyDependency(
  dependency: DependencyResult,
  hydrate: HydrateInstalledFile,
): IFileRequirement | undefined {
  const { definitionId, satisfyingEnabled, satisfyingDisabled, wrongEnabled, wrongDisabled } =
    dependency;

  // Correct version enabled: satisfied.
  if (satisfyingEnabled.length > 0) {
    return undefined;
  }

  const alternatives = dependency.recommended.map(toCandidate);

  // Wrong version enabled: not deliberate, so surface it.
  if (wrongEnabled.length > 0) {
    const enabledFile = hydrate(wrongEnabled[0]);
    if (!enabledFile) {
      return undefined;
    }

    // Correct version owned but disabled: switch the active version.
    if (satisfyingDisabled.length > 0) {
      const correctFile = hydrate(satisfyingDisabled[0]);
      if (!correctFile) {
        return undefined;
      }
      return {
        kind: "wrong-version-enabled",
        requirementDefId: definitionId,
        enabledFile,
        correctFile,
      };
    }

    // Correct version not owned: download one.
    return {
      kind: "wrong-version-installed",
      requirementDefId: definitionId,
      installedFile: enabledFile,
      alternatives,
    };
  }

  // Nothing wrong enabled: surface a fully missing chain; an owned-but-disabled
  // version is a deliberate choice.
  // TODO(future): optionally surface "enable the disabled correct version".
  if (satisfyingDisabled.length > 0 || wrongDisabled.length > 0) {
    return undefined;
  }

  return { kind: "missing", requirementDefId: definitionId, alternatives };
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

    fileRequirements[source.sourceFileVersionUid] = {
      sourceFileUID: source.sourceFileVersionUid,
      sourceModName: hydrate(source.sourceFileVersionUid)?.modName ?? "",
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
