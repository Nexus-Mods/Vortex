import type { HealthCheckId } from "../../types";
import type { FileRequirementCategory } from "../fileRequirements/fileRequirementReport";
import type {
  IFileRequirement,
  IFileRequirementBranch,
} from "../fileRequirements/mapRequirementsReport";

/**
 * Shared analytics vocabulary for the Health Check tracking events (LAZ-551).
 * The concrete events are emitted through the Health Check tracking context.
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
 * issue_type for an entry: the file-level requirements check surfaces
 * higher-confidence warnings, the mod-level check surfaces lower-confidence
 * suggestions. Exhaustive for the same reason as CHECK_NAMES.
 */
const ISSUE_TYPES: Record<HealthCheckId, IssueType> = {
  "check-file-level-requirements": "warning",
  "check-nexus-mod-requirements": "suggestion",
};

export const issueTypeForCheck = (checkId: HealthCheckId): IssueType => ISSUE_TYPES[checkId];

/**
 * Which issue an event belongs to, and which check surfaced it — the join key that ties
 * a user's events together across the funnel. Carried by every issue-scoped event; the
 * tracking context applies it, so call sites never restate it.
 *
 * Deliberately insensitive to the report's contents: `issue_id` is
 * `${sourceFileUID}:${category}`, so it stays put as requirements come and go underneath,
 * and as the issue is hidden and restored. That stability is the point — it is what lets
 * the funnel join, and what the ::hidden suffix was breaking. `IHealthCheckEntry.id` is
 * the row key that tracks report state; don't report that.
 */
export type IssueAnalyticsIdentity = {
  issue_id: string;
  check_id: CheckName;
};

/**
 * Identity for the premium surfaces, which appear both against a single issue (a listing
 * row or detail page) and page-wide, across both checks.
 */
export type OptionalIssueAnalyticsIdentity = Partial<IssueAnalyticsIdentity>;

/**
 * What state a requirement was in when the user acted on it. `disabled` is never reported
 * today: that state is suppressed as the user's deliberate choice.
 */
export type RequirementState =
  | "missing"
  | "wrong_version_enabled"
  | "downloaded"
  | "downloaded_wrong_enabled"
  | "disabled_wrong_enabled"
  | "disabled";

/** An OR is excluded because it has no single state; use branchRequirementState per option. */
export const requirementStateFor = (
  requirement: Exclude<IFileRequirement, { kind: "or" }>,
): RequirementState => {
  switch (requirement.kind) {
    case "missing":
      return "missing";
    case "wrong-version-installed":
      return "wrong_version_enabled";
    case "correct-version-uninstalled":
      return requirement.enabledFile ? "downloaded_wrong_enabled" : "downloaded";
    case "wrong-version-enabled":
      return "disabled_wrong_enabled";
  }
};

/** requirement_state for one of an OR's alternatives. */
export const branchRequirementState = (branch: IFileRequirementBranch): RequirementState => {
  switch (branch.kind) {
    case "download":
      return branch.enabledFile ? "wrong_version_enabled" : "missing";
    case "install":
      return branch.enabledFile ? "downloaded_wrong_enabled" : "downloaded";
    case "enable":
      return branch.enabledFile ? "disabled_wrong_enabled" : "disabled";
  }
};

/**
 * The state a group's items share — one category, so normally all of them. Undefined when
 * they differ, so the property is left off rather than reporting one item's state for all.
 */
export const sharedRequirementState = (
  requirements: IFileRequirement[],
): RequirementState | undefined => {
  const first = requirements[0];
  if (first === undefined || first.kind === "or") {
    return undefined;
  }
  const state = requirementStateFor(first);
  return requirements.every((req) => req.kind !== "or" && requirementStateFor(req) === state)
    ? state
    : undefined;
};

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
