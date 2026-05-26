import type { Severity } from "./severityStyles";

/**
 * The kind of problem a health check issue represents.
 *
 * The message shown to the user is derived from the issue type, NOT directly
 * from the severity. A single severity maps to many different issue types — a
 * "warning" today is always a missing required mod, but in the future it could
 * also be low disk space, a corrupted file, etc. Keeping a separate issue-type
 * dimension lets each of those carry its own copy while still rolling up to a
 * shared severity for styling.
 *
 * todo: this is a mocked list. Replace with the real set of issue types once the
 * health check data source exposes them, and derive the issue type from the
 * requirement/issue data instead of `getMockIssueType` below.
 */
export type HealthCheckIssueType =
  | "missing_required_mod"
  | "possible_missing_required_mod"
  | "low_space"
  | "file_corrupted";

/**
 * Maps each issue type to the severity used for its icon/colour styling.
 * todo: confirm these once real issue types land — they're best-guess mocks.
 */
export const issueTypeSeverityMap: Record<HealthCheckIssueType, Severity> = {
  missing_required_mod: "warning",
  possible_missing_required_mod: "suggestion",
  low_space: "warning",
  file_corrupted: "error",
};

/**
 * i18n key (within the `health_check` namespace) for an issue type's message.
 * Pair with the corresponding entry under `issue_message` in the locale files.
 */
export const getIssueMessageKey = (issueType: HealthCheckIssueType): string =>
  `issue_message::${issueType}`;

// todo delete: returns a random issue type so the UI can be exercised in every
// state until the real data source is wired up.
export const getMockIssueType = (): HealthCheckIssueType => {
  const types = Object.keys(issueTypeSeverityMap) as HealthCheckIssueType[];
  return types[Math.floor(Math.random() * types.length)];
};
