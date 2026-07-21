import type {
  Candidate,
  DependencyBranch,
  DependencyResult,
  FileRequirementsReport,
} from "@nexusmods/file-dependency-resolver";

import type { IDownloadedFile, IInstalledFile } from "./installedFiles";

/**
 * A downloadable file the user can fetch to satisfy a requirement
 */
export interface IFileRequirementCandidate {
  /** Composite id for the file version (game-scoped fileId combined with the game id) */
  fileUID: string;
  /** Composite id for the mod (game-scoped modId combined with the game id) */
  modUID: string;
  /** Display name of the mod */
  modName: string;
  /** Mod summary */
  modSummary?: string;
  /** Thumbnail URL if available */
  thumbnailUrl?: string;
  /** File name */
  fileName: string;
  /** File version */
  version: string;
  /** Whether the mod is flagged as adult content */
  adultContent: boolean;
}

/**
 * Dependency not installed; download a file to satisfy it
 */
export interface IMissingFileRequirement {
  kind: "missing";
  /** Requirement definition id */
  requirementDefId: string;
  /** The file to download */
  candidate: IFileRequirementCandidate;
}

/**
 * A wrong version of the chain is enabled and no acceptable version is owned;
 * download a different (correct) version.
 */
export interface IWrongVersionInstalledRequirement {
  kind: "wrong-version-installed";
  /** Requirement definition id */
  requirementDefId: string;
  /** The wrong version currently enabled */
  installedFile: IInstalledFile;
  /** The correct version to download */
  candidate: IFileRequirementCandidate;
}

/**
 * Correct and wrong versions installed, wrong one enabled; switch the active version
 */
export interface IWrongVersionEnabledRequirement {
  kind: "wrong-version-enabled";
  /** Requirement definition id */
  requirementDefId: string;
  /** The wrong version currently enabled */
  enabledFile: IInstalledFile;
  /** The correct, disabled version to enable */
  correctFile: IInstalledFile;
}

/**
 * One alternative (update group) of an OR requirement, already classified to the
 * action it needs if chosen: download a file, or enable an owned-but-disabled one.
 */
export type IFileRequirementBranch =
  | {
      kind: "download";
      /** Update group this alternative belongs to */
      modFileId: string;
      /** The file to download for this alternative */
      candidate: IFileRequirementCandidate;
    }
  | {
      kind: "enable";
      /** Update group this alternative belongs to */
      modFileId: string;
      /** The acceptable, installed-but-disabled version to enable */
      correctFile: IInstalledFile;
      /** A wrong version of the same chain currently enabled, if any (makes it a switch) */
      enabledFile?: IInstalledFile;
    };

/**
 * Several alternatives satisfy the requirement; the user picks one. Branches that
 * are owned-but-disabled offer an enable/switch action instead of a download.
 */
export interface IOrFileRequirement {
  kind: "or";
  /** Requirement definition id */
  requirementDefId: string;
  /** The OR alternatives, one per update group */
  branches: IFileRequirementBranch[];
}

/**
 * Correct version downloaded but not installed; install it to satisfy the requirement
 */
export interface IUninstalledFileRequirement {
  kind: "correct-version-uninstalled";
  /** Requirement definition id */
  requirementDefId: string;
  /** The downloaded-but-not-installed file to install */
  uninstalledFile: IDownloadedFile;
}

/**
 * A single dependency of a source file, discriminated on kind
 */
export type IFileRequirement =
  | IMissingFileRequirement
  | IWrongVersionInstalledRequirement
  | IWrongVersionEnabledRequirement
  | IUninstalledFileRequirement
  | IOrFileRequirement;

/**
 * Unsatisfied requirements for one source file, as the resolver maps them. The UI
 * splits this into homogeneous per-category reports (IFileRequirementReport) for display.
 */
export interface IFileLevelRequirements {
  /** Composite id of the source file version that has the requirements */
  sourceFileUID: string;
  /** Source mod name, for the listing and detail headings */
  sourceModName: string;
  /** Composite id for the source mod, for building its Nexus links */
  sourceModUID: string;
  /** The source file's unsatisfied dependencies (kinds can be mixed) */
  requirements: IFileRequirement[];
}

/**
 * Metadata for the file-level requirements health check result
 */
export interface IFileRequirementsCheckMetadata {
  /** Game ID this check was run for */
  gameId: string;
  /** Total number of installed files inspected */
  modsChecked: number;
  /** Requirements keyed by source file UID */
  fileRequirements: { [fileUID: string]: IFileLevelRequirements };
  /** Any errors encountered during the check */
  errors: string[];
}

/** Discriminated union of the two file shapes the hydrator can return. */
export type HydratedFile =
  | { kind: "installed"; file: IInstalledFile }
  | { kind: "downloaded"; file: IDownloadedFile };

/** Resolves a file's display data from its composite file UID. */
export type HydrateFile = (fileUID: string) => HydratedFile | undefined;

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
  hydrate: HydrateFile,
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
      const hydratedEnabled = hydrate(branch.wrongEnabled[0]);
      const hydratedCorrect = hydrate(branch.satisfyingDisabled[0]);
      if (
        !hydratedEnabled ||
        hydratedEnabled.kind !== "installed" ||
        !hydratedCorrect ||
        hydratedCorrect.kind !== "installed"
      ) {
        return undefined;
      }
      return {
        kind: "wrong-version-enabled",
        requirementDefId: definitionId,
        enabledFile: hydratedEnabled.file,
        correctFile: hydratedCorrect.file,
      };
    }
    // Owned-but-disabled with nothing wrong enabled is a deliberate choice.
    // TODO(future): optionally surface "enable the disabled correct version".
    return undefined;
  }

  // Correct version downloaded but not yet installed.
  if (branch.satisfyingUninstalled.length > 0) {
    const hydrated = hydrate(branch.satisfyingUninstalled[0]);
    if (!hydrated || hydrated.kind !== "downloaded") {
      return undefined;
    }
    return {
      kind: "correct-version-uninstalled",
      requirementDefId: definitionId,
      uninstalledFile: hydrated.file,
    } satisfies IUninstalledFileRequirement;
  }

  // No acceptable version owned: download one, when the resolver found a candidate.
  if (!branch.recommended) {
    return undefined;
  }
  const candidate = toCandidate(branch.recommended);

  // A wrong version is enabled: this is a "requires a different version" download.
  if (branch.wrongEnabled.length > 0) {
    const hydrated = hydrate(branch.wrongEnabled[0]);
    if (!hydrated || hydrated.kind !== "installed") {
      return undefined;
    }
    return {
      kind: "wrong-version-installed",
      requirementDefId: definitionId,
      installedFile: hydrated.file,
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
  hydrate: HydrateFile,
): IFileRequirementBranch | undefined {
  // Owned-but-disabled alternative: enabling it satisfies the OR without a download.
  if (branch.satisfyingDisabled.length > 0) {
    const hydratedCorrect = hydrate(branch.satisfyingDisabled[0]);
    if (!hydratedCorrect || hydratedCorrect.kind !== "installed") {
      return undefined;
    }
    const hydratedEnabled =
      branch.wrongEnabled.length > 0 ? hydrate(branch.wrongEnabled[0]) : undefined;
    const enabledFile = hydratedEnabled?.kind === "installed" ? hydratedEnabled.file : undefined;
    return {
      kind: "enable",
      modFileId: branch.modFileId,
      correctFile: hydratedCorrect.file,
      enabledFile,
    };
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
 * files only for surfaced dependencies.
 */
export function mapRequirementsReport(
  report: FileRequirementsReport,
  hydrate: HydrateFile,
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
      sourceModName: sourceFile?.file.modName ?? "",
      sourceModUID: sourceFile?.file.modUID ?? "",
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
