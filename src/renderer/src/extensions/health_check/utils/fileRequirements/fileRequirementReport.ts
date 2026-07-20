import type { IInstalledFile } from "./installedFiles";
import type {
  IFileRequirement,
  IFileRequirementBranch,
  IFileRequirementCandidate,
  IUninstalledFileRequirement,
} from "./mapRequirementsReport";

// Pure helpers over a report's IFileRequirement[]: category mapping and the
// per-category slices (downloads, uninstalled files, version switches) the
// listing row and detail view drive their actions from. No React or state.

/**
 * Report category for a source file's unsatisfied dependencies. Each category
 * groups homogeneous requirements with their own copy, buttons and detail layout;
 * a single source file can surface several categories at once. Maps 1:1 onto the
 * IFileRequirement kinds via `categoryOf`.
 */
export type FileRequirementCategory =
  /** Missing: download (and install) a file. No user choice needed. */
  | "download"
  /** A wrong version is enabled and the correct one isn't owned: download a different version. */
  | "download-replace"
  /**
   * Correct version downloaded but not installed: install it. Reserved; not
   * produced until uninstalled-state support lands (no resolver input yet).
   */
  | "install-uninstalled"
  /** Correct version installed but disabled while a wrong one is enabled: switch the active version. */
  | "toggle"
  /** Several alternatives satisfy the requirement; the user picks one. */
  | "or";

/**
 * One category's worth of a source file's requirements: a single listing entry /
 * detail page. `requirements` are homogeneous to `category`.
 */
export interface IFileRequirementReport {
  /** Composite id of the source file version that has the requirements */
  sourceFileUID: string;
  /** Source mod name, for the listing and detail headings */
  sourceModName: string;
  /** Composite id for the source mod, for building its Nexus links */
  sourceModUID: string;
  /** The report category, driving copy, buttons and the detail layout */
  category: FileRequirementCategory;
  /** The source file's unsatisfied dependencies in this category */
  requirements: IFileRequirement[];
}

/** The report category a requirement belongs to; drives grouping, copy and layout. */
export const categoryOf = (requirement: IFileRequirement): FileRequirementCategory => {
  switch (requirement.kind) {
    case "missing":
      return "download";
    case "wrong-version-installed":
      return "download-replace";
    case "correct-version-uninstalled":
      return "install-uninstalled";
    case "wrong-version-enabled":
      return "toggle";
    case "or":
      return "or";
  }
};

/** Files to download for a report; OR/toggle/install-uninstalled need a user choice or different action. */
export const downloadCandidates = (requirements: IFileRequirement[]): IFileRequirementCandidate[] =>
  requirements.flatMap((requirement) => {
    switch (requirement.kind) {
      case "missing":
      case "wrong-version-installed":
        return [requirement.candidate];
      default:
        return [];
    }
  });

/** Categories whose downloads can be installed in one click (no user choice needed). */
export const canQuickInstall = (category: FileRequirementCategory): boolean =>
  category === "download" || category === "download-replace";

/** Uninstalled files for a report; only the install-uninstalled category contributes. */
export const uninstalledFiles = (
  requirements: IFileRequirement[],
): Extract<IFileRequirement, IUninstalledFileRequirement>[] =>
  requirements.filter(
    (r): r is Extract<IFileRequirement, IUninstalledFileRequirement> =>
      r.kind === "correct-version-uninstalled",
  );

/** The wrong -> correct version switches a toggle report needs (one per requirement). */
export const switchTargets = (
  requirements: IFileRequirement[],
): Array<{ wrong: IInstalledFile; correct: IInstalledFile }> =>
  requirements.flatMap((requirement) =>
    requirement.kind === "wrong-version-enabled"
      ? [{ wrong: requirement.enabledFile, correct: requirement.correctFile }]
      : [],
  );

/** The required mod's display name for one OR alternative. */
const branchModName = (branch: IFileRequirementBranch): string =>
  branch.kind === "download" ? branch.candidate.modName : branch.correctFile.modName;

/** The required mod's display name for a requirement (used in the listing summary). */
export const requirementModName = (requirement: IFileRequirement, orJoin: string): string => {
  switch (requirement.kind) {
    case "missing":
      return requirement.candidate.modName;
    case "wrong-version-installed":
      return requirement.candidate.modName || requirement.installedFile.modName;
    case "correct-version-uninstalled":
      return requirement.uninstalledFile.modName;
    case "wrong-version-enabled":
      return requirement.correctFile.modName;
    case "or":
      return requirement.branches.map(branchModName).join(orJoin);
  }
};
