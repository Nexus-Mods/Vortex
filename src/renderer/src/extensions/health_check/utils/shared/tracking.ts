import type { HealthCheckId } from "../../types";
import type { FileRequirementCategory } from "../fileRequirements/fileRequirementReport";

/**
 * Shared analytics vocabulary for the Health Check tracking events (LAZ-551).
 * The concrete events are emitted through the useHealthCheckTracking hook.
 */

/** Confidence band of an issue: file-level requirements are warnings, mod-level are suggestions. */
export type IssueType = "warning" | "suggestion";

/** The resolution flow an issue offers. */
export type ResolutionType = "install" | "enable" | "pick" | "update";

/** Which listing tab is active. */
export type HealthCheckTab = "active" | "hidden";

/**
 * Which check an issue came from, as a stable analytics name. Deliberately decoupled
 * from the internal `HealthCheckId` constants so renaming a check id can't silently
 * break reporting, and it is the discriminator the KPIs split on — `issue_type` only
 * has two values, so a third check would have to reuse one and collide.
 */
export type CheckName = "file_requirements" | "mod_requirements";

/**
 * Exhaustive by construction: registering a third check widens `HealthCheckId` and
 * makes this a build error, rather than silently reporting the new check as one of
 * the existing two.
 */
const CHECK_NAMES: Record<HealthCheckId, CheckName> = {
  "check-file-level-requirements": "file_requirements",
  "check-nexus-mod-requirements": "mod_requirements",
};

/** check_id for an entry — the reliable per-check key on every issue-scoped event. */
export const checkNameForCheck = (checkId: HealthCheckId): CheckName => CHECK_NAMES[checkId];

/**
 * issue_type for an entry, keyed off the check it belongs to: the file-level
 * requirements check surfaces higher-confidence warnings, the mod-level check
 * surfaces lower-confidence suggestions.
 */
export const issueTypeForCheck = (checkId: HealthCheckId): IssueType =>
  checkId === "check-file-level-requirements" ? "warning" : "suggestion";

/**
 * resolution_type for a file-requirement report category. Mod requirements are
 * always an install, so callers there pass "install" directly.
 */
export const resolutionTypeForCategory = (category: FileRequirementCategory): ResolutionType => {
  switch (category) {
    case "toggle":
      return "enable";
    case "or":
      return "pick";
    case "download-replace":
      return "update";
    case "download":
    case "install-uninstalled":
      return "install";
  }
};
