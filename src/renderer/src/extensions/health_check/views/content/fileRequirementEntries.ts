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
      id: `${source.sourceFileUID}:${category}${hidden ? "::hidden" : ""}`,
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
