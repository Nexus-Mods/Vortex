/**
 * The tracking context is a pure refactor of how the issue identity reaches an event — the
 * wire format must be unchanged. These tests pin that: a call made inside an IssueProvider
 * produces the same payload as the hand-written one it replaced, and a premium surface
 * outside one still omits the properties the cross-check contract says it should.
 */
import { EventEmitter } from "events";

import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import type { MixpanelEvent } from "../../analytics/mixpanel/MixpanelEvents";
import type { IHealthCheckEntry } from "../views/content/types";
import { createHealthCheckTracker } from "./healthCheckTracker";
import {
  HealthCheckTrackingProvider,
  IssueProvider,
  useIssue,
  useIssueTracking,
  useOptionalIssue,
  useTracker,
} from "./HealthCheckTracking.context";

function harness() {
  const emitter = new EventEmitter();
  const events: MixpanelEvent[] = [];
  emitter.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
  return { api: { events: emitter } as unknown as IExtensionApi, events };
}

const fileEntry: IHealthCheckEntry = {
  id: "uid-42:download",
  checkId: "check-file-level-requirements",
  severity: "warning",
  resolutionType: "update",
  data: {},
};

const modEntry: IHealthCheckEntry = {
  id: "7-uid-9",
  checkId: "check-nexus-mod-requirements",
  severity: "suggestion",
  resolutionType: "install",
  data: {},
};

/** Emits back_clicked with only its own properties — the identity should be supplied. */
const BackClicker = () => {
  const { trackBackClicked } = useIssueTracking();
  trackBackClicked({ time_spent_on_detail_ms: 900 });
  return null;
};

/** Emits an event carrying issue_type, to show both come from the enclosing issue. */
const Unhider = () => {
  const { trackIssueUnhidden } = useIssueTracking();
  const { issueType } = useIssue();
  trackIssueUnhidden({ issue_type: issueType });
  return null;
};

/** A premium surface: reads an optional identity, so it works with or without an issue. */
const Banner = () => {
  const { trackPremiumBannerShown } = useTracker();
  const identity = useOptionalIssue()?.identity;
  trackPremiumBannerShown({ ...identity, placement: "list", total_issues: 3 });
  return null;
};

/** Requires an issue; used to prove it throws rather than emitting without one. */
const RequiresIssue = () => {
  useIssueTracking();
  return null;
};

describe("HealthCheckTracking context", () => {
  it("injects the identity, matching the payload the call site used to build by hand", () => {
    const { api, events } = harness();

    render(
      <HealthCheckTrackingProvider api={api}>
        <IssueProvider entry={fileEntry}>
          <BackClicker />
        </IssueProvider>
      </HealthCheckTrackingProvider>,
    );

    // The pre-refactor form, emitted through the raw tracker.
    createHealthCheckTracker(api).trackBackClicked({
      issue_id: "uid-42:download",
      check_id: "file_requirements",
      time_spent_on_detail_ms: 900,
    });

    expect(events).toHaveLength(2);
    expect(events[0].eventName).toBe("health_check_back_clicked");
    expect(events[0].properties).toEqual(events[1].properties);
  });

  it("scopes each issue to its own check", () => {
    const { api, events } = harness();

    render(
      <HealthCheckTrackingProvider api={api}>
        <IssueProvider entry={fileEntry}>
          <Unhider />
        </IssueProvider>

        <IssueProvider entry={modEntry}>
          <Unhider />
        </IssueProvider>
      </HealthCheckTrackingProvider>,
    );

    expect(events.map((e) => e.properties)).toEqual([
      { issue_id: "uid-42:download", check_id: "file_requirements", issue_type: "warning" },
      { issue_id: "7-uid-9", check_id: "mod_requirements", issue_type: "suggestion" },
    ]);
  });

  it("reports one issue_id either side of a hide, so the funnel still joins", () => {
    const { api, events } = harness();

    // A file requirement's row key gains a ::hidden suffix once dismissed, but it is the
    // same issue, so issueId stays put.
    const dismissed: IHealthCheckEntry = {
      ...fileEntry,
      id: `${fileEntry.id}::hidden`,
      issueId: fileEntry.id,
    };

    render(
      <HealthCheckTrackingProvider api={api}>
        <IssueProvider entry={fileEntry}>
          <Unhider />
        </IssueProvider>

        <IssueProvider entry={dismissed}>
          <Unhider />
        </IssueProvider>
      </HealthCheckTrackingProvider>,
    );

    expect(events.map((e) => e.properties.issue_id as string)).toEqual([
      fileEntry.id,
      fileEntry.id,
    ]);
  });

  it("omits the identity for a premium surface rendered page-wide", () => {
    const { api, events } = harness();

    render(
      <HealthCheckTrackingProvider api={api}>
        <Banner />
      </HealthCheckTrackingProvider>,
    );

    expect(events[0].properties).toEqual({ placement: "list", total_issues: 3 });
  });

  it("throws rather than emitting an issue event with no identity", () => {
    const { api } = harness();

    // React logs the boundary-less error; the assertion is on the throw itself.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(
        <HealthCheckTrackingProvider api={api}>
          <RequiresIssue />
        </HealthCheckTrackingProvider>,
      ),
    ).toThrow("useIssueTracking must be used within an IssueProvider");

    consoleError.mockRestore();
  });
});
