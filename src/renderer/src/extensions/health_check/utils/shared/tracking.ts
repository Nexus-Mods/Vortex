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

/** Where a premium prompt was surfaced from. */
export type PremiumTriggerContext = "single_install" | "batch_install" | "install_all";

/** Which free-user fallback the premium modal offered. */
export type PremiumFallbackType = "single_mod_page" | "batch_mod_pages";

/** Where the premium banner is shown. */
export type BannerContext = "list" | "detail";

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
