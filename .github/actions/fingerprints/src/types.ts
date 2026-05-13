/**
 * Lifecycle stage of a fingerprint in `vortex.resolved_fingerprints`.
 */
export const Status = {
  /**
   * A PR resolving the error has merged but the fix has not yet shipped —
   * the affected error may still surface in released builds.
   */
  Fixed: "fixed",
  /**
   * The fix has landed in a tagged release; the error should no longer
   * appear in users running that version or later.
   */
  Released: "released",
  /**
   * The error fingerprint is being ignored on purpose: it represents a
   * non-bug (false positive, expected error in some user environments,
   * out-of-our-control third-party failure, etc.). The dashboard should
   * filter it out the same way as `released`, but there is no fix and no
   * `release_version`. Terminal state — only set via `mode: resolve`.
   */
  Ignored: "ignored",
} as const;
export type Status = (typeof Status)[keyof typeof Status];

export const STATUSES: readonly Status[] = Object.values(Status);
export const isStatus = (s: string): s is Status => STATUSES.some((v) => v === s);

/**
 * Trigger source the action is being invoked for.
 */
export const Mode = {
  /**
   * Read the current `pull_request` event's body and mark every
   * `Fixes fingerprint XXXXXXXX` reference as `fixed`.
   */
  PR: "pr",
  /**
   * On a `v*` tag push, walk PRs merged since the previous tag and mark
   * each referenced fingerprint as `released` for that version.
   */
  Release: "release",
  /**
   * Manually add or remove fingerprints via `workflow_dispatch` inputs
   * (typically used to backfill or correct entries by hand).
   */
  Resolve: "resolve",
} as const;
export type Mode = (typeof Mode)[keyof typeof Mode];

export const MODES: readonly Mode[] = Object.values(Mode);
export const isMode = (s: string): s is Mode => MODES.some((v) => v === s);

export type DbMode = "insert" | "delete";

export interface FingerprintRow {
  fingerprint: string;
  pr_url: string;
  updated_by: string;
  release_version: string;
  status: Status;
}

export interface CollectResult {
  rows: FingerprintRow[];
  dbMode: DbMode;
}

export const FINGERPRINT_RE = /^[a-f0-9]{8}$/i;

/**
 * Matches `Fixes fingerprint <hex>` and `Fixes fingerprints <hex>(, <hex>)*`
 * lines. The capture group is the raw fingerprint list — split it on
 * `[\s,]+` to get individual values.
 */
export const PR_FINGERPRINT_RE = /^Fixes fingerprints? ([a-f0-9]{8}(?:[\s,]+[a-f0-9]{8})*)\b/gim;
