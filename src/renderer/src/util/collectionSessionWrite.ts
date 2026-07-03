/**
 * Planning + resolving writes to the collection install session. This is the WRITE side
 * of the session (the read side is collectionInstallSessionSelectors). It is internal to
 * the install flow - InstallManager uses it directly for automatic lifecycle writes; it
 * is deliberately NOT re-exported through the public api barrels.
 */
import type { IModReference } from "../extensions/mod_management/types/IMod";
import type { CollectionModStatus } from "../types/collections/ICollectionInstallSession";
import type { IState } from "../types/IState";
import { referenceId } from "./collectionInstallSession";
import { getCollectionActiveSession } from "./collectionInstallSessionSelectors";

/**
 * An install lifecycle outcome to record against a session mod. "installed" is its own
 * variant (it carries the modId), so the status variant excludes it - an installed status
 * is unrepresentable as a plain status update.
 */
export type CollectionInstallOutcome =
  | { type: "status"; status: Exclude<CollectionModStatus, "installed"> }
  | { type: "installed"; modId: string };

/** What writing an outcome should do to the session (or nothing). */
export type CollectionSessionWrite =
  | { kind: "updateStatus"; status: CollectionModStatus }
  | { kind: "markInstalled"; modId: string }
  | { kind: "none" };

/**
 * Decide how an automatic install outcome should be written to a session mod, given that
 * mod's current status. This is the single source of the automatic write rules (the skip
 * path, markCollectionMemberSkipped, deliberately bypasses it - see below):
 *
 * - "ignored" is the user's final word: no automatic write overrides it. The user changes
 *   it by un-ignoring/resuming; markCollectionMemberSkipped sets it directly (bypassing this
 *   planner) precisely so an explicit skip CAN override a prior installed/in-progress state.
 * - reaching "installed" wins over any in-progress or failed state (recorded via
 *   markModInstalled, which carries the modId) - but not over a user "ignored".
 * - a completed install ("installed") is not downgraded by a late/stray in-progress event.
 * - "failed" is intentionally NOT sticky: a requeue/retry can revert it forward, and it
 *   still counts toward completion separately (see getCollectionInstallProgress).
 */
export function planSessionWrite(
  currentStatus: CollectionModStatus | undefined,
  outcome: CollectionInstallOutcome,
): CollectionSessionWrite {
  if (currentStatus === "ignored") {
    return { kind: "none" };
  }
  if (outcome.type === "installed") {
    return { kind: "markInstalled", modId: outcome.modId };
  }
  if (currentStatus === "installed") {
    return { kind: "none" };
  }
  return { kind: "updateStatus", status: outcome.status };
}

/** What the dependency-install error handler should do with a member whose attempt threw. */
export type DependencyErrorRecovery =
  | { action: "leave" } // decided elsewhere (explicit skip) or whole install torn down: do nothing
  | { action: "requeue" } // retryable: attempt again
  | { action: "fail"; showError: boolean }; // terminal: settle as failed, report only a real error

/**
 * Decide how to recover a collection dependency whose install/download attempt threw. The sibling
 * of planSessionWrite on the error path - pure, so the policy is testable apart from the install
 * machinery:
 * - an explicitly skipped member (ruleIgnored) or a whole-install cancel (installCanceled) is left
 *   untouched - the skip is terminal and a cancelled install is rebuilt on resume; requeuing a
 *   skipped member would re-prompt the very download a free user just skipped;
 * - a non-retryable failure (e.g. the disk is full) is settled as failed immediately - retrying
 *   cannot succeed, so burning the retry budget only leaves the member non-terminal for longer;
 * - otherwise, while retries remain the member is requeued - a transient error or a download
 *   cancelled as collateral (a sibling torn down during the free-user skip cascade) must not
 *   abandon the member non-terminal, which would block completion and re-prompt next pass;
 * - once retries are exhausted it is settled as failed (terminal) so the collection can still
 *   complete, surfacing an error only for a genuine failure, never for a user cancellation.
 */
export function planDependencyErrorRecovery(input: {
  installCanceled: boolean;
  ruleIgnored: boolean;
  isCanceled: boolean;
  hasRetriesLeft: boolean;
  nonRetryable?: boolean;
}): DependencyErrorRecovery {
  if (input.installCanceled || input.ruleIgnored) {
    return { action: "leave" };
  }
  if (!input.nonRetryable && input.hasRetriesLeft) {
    return { action: "requeue" };
  }
  return { action: "fail", showError: !input.isCanceled };
}

/** A resolved session write: which session/rule to update and how. */
export interface IResolvedSessionWrite {
  sessionId: string;
  ruleId: string;
  // never "none" - a no-op resolves to a null result instead
  write: Exclude<CollectionSessionWrite, { kind: "none" }>;
}

/**
 * Resolve how an install lifecycle outcome should be written to the active session,
 * given the reference of the dependency the outcome is about. The orchestrator
 * (InstallManager) always has the dependency in hand, so the rule is matched by
 * reference identity (referenceId, the same identity the session-mods key uses) rather
 * than by lookup. Combines the active-session lookup, rule matching and planSessionWrite
 * into one step so a writer can record progress with a single call. The returned ruleId
 * is the session-mods key.
 *
 * Returns null when there is no active session, no rule matches the reference, or the
 * write would be a no-op (e.g. a downgrade from a protected state).
 */
export function sessionWriteForDependency(
  state: IState,
  reference: IModReference,
  outcome: CollectionInstallOutcome,
): IResolvedSessionWrite | null {
  const session = getCollectionActiveSession(state);
  if (session === undefined) {
    return null;
  }
  const target = referenceId(reference);
  if (target === undefined) {
    // a reference with no identifying field can't be matched to a specific rule; bail
    // rather than aliasing onto another id-less rule (undefined === undefined)
    return null;
  }
  const entry = Object.entries(session.mods).find(
    ([, info]) => referenceId(info.rule.reference) === target,
  );
  if (entry === undefined) {
    return null;
  }
  const [ruleId, info] = entry;
  const write = planSessionWrite(info.status, outcome);
  if (write.kind === "none") {
    return null;
  }
  return { sessionId: session.sessionId, ruleId, write };
}
