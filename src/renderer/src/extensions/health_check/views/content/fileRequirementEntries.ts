import {
  categoryOf,
  type FileRequirementCategory,
  type IFileRequirementReport,
} from "@/extensions/health_check/utils/fileRequirements/fileRequirementReport";
import type {
  IFileLevelRequirements,
  IFileRequirement,
} from "@/extensions/health_check/utils/fileRequirements/mapRequirementsReport";

import { FILE_REQUIREMENTS_CHECK_ID } from "../../checks/fileRequirementsCheck";
import { hiddenFileRequirements } from "../../selectors";
import type { IHealthCheckEntry } from "./types";

/** Whether a (homogeneous, per-category) report entry's requirements are all hidden. */
export const isFileEntryHidden = (
  state: Parameters<typeof hiddenFileRequirements>[0],
  entry: IHealthCheckEntry,
): boolean => {
  const report = entry.data as IFileRequirementReport;
  const hidden = hiddenFileRequirements(state)[report.sourceFileUID] ?? [];
  return (
    report.requirements.length > 0 &&
    report.requirements.every((req) => hidden.includes(req.requirementDefId))
  );
};

/**
 * The issue one source file's requirements of a given category represent — the same
 * whether they are showing or dismissed, so it is what the analytics events report as
 * `issue_id` and what the bulk-install path attributes an install to.
 */
export const fileIssueId = (sourceFileUID: string, category: FileRequirementCategory): string =>
  `${sourceFileUID}:${category}`;

/**
 * Listing-row key. A partially dismissed file contributes both a showing and a dismissed
 * entry for the same category, so the row key has to tell them apart even though they are
 * one issue — hence the suffix here and not in fileIssueId.
 */
const fileRowKey = (
  sourceFileUID: string,
  category: FileRequirementCategory,
  hidden: boolean,
): string => `${fileIssueId(sourceFileUID, category)}${hidden ? "::hidden" : ""}`;

/** Group one source file's (visible or hidden) requirements into per-category report entries. */
export const pushReportEntries = (
  entries: IHealthCheckEntry[],
  source: IFileLevelRequirements,
  requirements: IFileRequirement[],
  hidden: boolean,
): void => {
  const byCategory = new Map<FileRequirementCategory, IFileRequirement[]>();

  for (const requirement of requirements) {
    const category = categoryOf(requirement);
    const bucket = byCategory.get(category);

    if (bucket) {
      bucket.push(requirement);
    } else {
      byCategory.set(category, [requirement]);
    }
  }

  for (const [category, reqs] of byCategory) {
    entries.push({
      id: fileRowKey(source.sourceFileUID, category, hidden),
      issueId: fileIssueId(source.sourceFileUID, category),
      checkId: FILE_REQUIREMENTS_CHECK_ID,
      severity: "warning",
      data: {
        sourceFileUID: source.sourceFileUID,
        sourceModName: source.sourceModName,
        sourceModUID: source.sourceModUID,
        category,
        requirements: reqs,
      },
    });
  }
};
