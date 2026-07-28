import React, { createContext, useContext, useMemo, type ReactNode } from "react";

import type { IExtensionApi } from "@/types/IExtensionContext";

import type { IssueIdentity, IssueType } from "../utils/shared/tracking";
import { checkNameForCheck, issueTypeForCheck } from "../utils/shared/tracking";
import type { IHealthCheckEntry } from "../views/content/types";
import { createHealthCheckTracker, type HealthCheckTracker } from "./healthCheckTracker";

/**
 * Ambient Health Check analytics (LAZ-551). Both checks emit the same `health_check_*`
 * event names, so every issue-scoped event has to carry `issue_id` and `check_id` to stay
 * separable. Threading those through each component by hand meant restating the same fact
 * at ~27 call sites, where a miss is invisible at compile time and unrecoverable in the
 * data. Here the issue is ambient instead: components declare what happened.
 *
 * Two providers, because the identity is genuinely optional for the premium surfaces —
 * they appear both against a single issue and page-wide. A premium component rendered
 * outside an IssueProvider reads no identity and emits without those properties, which
 * is exactly the cross-check contract agreed with the data team. The component tree now
 * enforces what used to be a manual convention.
 */

const TrackerContext = createContext<HealthCheckTracker | undefined>(undefined);

/** The issue an event belongs to, plus the issue_type that goes with it. */
interface IIssueValue {
  identity: IssueIdentity;
  issueType: IssueType;
}

/**
 * The tracker methods whose event requires an issue identity — i.e. those taking a
 * required `IssueIdentity`. The premium methods take `OptionalIssueIdentity`, whose
 * `issue_id` is `string | undefined`, so they don't match and are excluded.
 */
type IssueMethod<T> = {
  [K in keyof T]: T[K] extends (props: infer P) => void
    ? P extends IssueIdentity
      ? K
      : never
    : never;
}[keyof T];

/**
 * The tracker as seen from inside an issue: the same methods with `issue_id` and
 * `check_id` already applied, and the cross-check and optional-identity methods dropped
 * so they can't be called from here and silently lose their identity.
 */
export type IssueTracker = {
  [K in IssueMethod<HealthCheckTracker>]: HealthCheckTracker[K] extends (props: infer P) => void
    ? (props: Omit<P, keyof IssueIdentity>) => void
    : never;
};

const IssueContext = createContext<IIssueValue | undefined>(undefined);

/** Provides the tracker for the whole Health Check page. */
export const HealthCheckTrackingProvider = ({
  api,
  children,
}: {
  api: IExtensionApi;
  children?: ReactNode;
}) => {
  const tracker = useMemo(() => createHealthCheckTracker(api), [api]);

  return <TrackerContext.Provider value={tracker}>{children}</TrackerContext.Provider>;
};

/**
 * The analytics view of a listing entry: how events name it, and its confidence band.
 * Prefers `issueId` over the row key, so an issue that is hidden and then restored keeps
 * one identity — otherwise the events either side of that would never join.
 */
const issueFor = (entry: IHealthCheckEntry): IIssueValue => ({
  identity: {
    issue_id: entry.issueId ?? entry.id,
    check_id: checkNameForCheck(entry.checkId),
  },
  issueType: issueTypeForCheck(entry.checkId),
});

/** Scopes everything below it to one listing entry. */
export const IssueProvider = ({
  entry,
  children,
}: {
  entry: IHealthCheckEntry;
  children?: ReactNode;
}) => {
  // entry is re-derived from live state as checks re-run, so key off its id and check
  // rather than the object.
  const value = useMemo(
    () => issueFor(entry),
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [entry.id, entry.checkId],
  );

  return <IssueContext.Provider value={value}>{children}</IssueContext.Provider>;
};

/** The unscoped tracker, for cross-check aggregates and the page-level premium surfaces. */
export const useTracker = (): HealthCheckTracker => {
  const tracker = useContext(TrackerContext);

  if (tracker === undefined) {
    throw new Error("useTracker must be used within a HealthCheckTrackingProvider");
  }

  return tracker;
};

/**
 * The enclosing issue, or undefined page-wide. Only for the premium surfaces, whose identity
 * is genuinely optional — everywhere else use useIssue so a missing provider is loud.
 */
export const useOptionalIssue = (): IIssueValue | undefined => useContext(IssueContext);

/**
 * The enclosing issue: its identity to spread onto an event or hand to an install action, and
 * the issue_type for the events that carry one.
 */
export const useIssue = (): IIssueValue => {
  const issue = useOptionalIssue();

  if (issue === undefined) {
    throw new Error("useIssue must be used within an IssueProvider");
  }

  return issue;
};

/**
 * The tracker with the enclosing issue already applied. Throws outside an
 * IssueProvider rather than emitting an event missing its dimensions — an analytics
 * property that was never sent cannot be backfilled.
 */
export const useIssueTracking = (): IssueTracker => {
  const tracker = useTracker();
  const issue = useOptionalIssue();

  // Memoised before the guard, so the hook order is unconditional. Binding every method
  // (rather than just the subset IssueTracker exposes) keeps this a one-liner; the
  // excluded ones aren't reachable through the type.
  const issueTracker = useMemo(
    () =>
      issue === undefined
        ? undefined
        : (Object.fromEntries(
            Object.entries(tracker).map(([name, emit]) => [
              name,
              (props: Record<string, unknown> = {}) =>
                (emit as (p: Record<string, unknown>) => void)({ ...issue.identity, ...props }),
            ]),
          ) as IssueTracker),
    [tracker, issue],
  );

  if (issueTracker === undefined) {
    throw new Error("useIssueTracking must be used within an IssueProvider");
  }

  return issueTracker;
};
