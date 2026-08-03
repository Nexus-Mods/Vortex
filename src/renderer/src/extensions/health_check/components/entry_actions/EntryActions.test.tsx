/**
 * EntryActions owns the three feedback events, so this covers what isn't visible at the
 * tracker level: which affordance produces which event, and in particular that abandoning
 * the reasons modal is recorded at all — before this it was recorded nowhere, neither as
 * an event nor in state.
 */
import { EventEmitter } from "events";

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import type { MixpanelEvent } from "../../../analytics/mixpanel/MixpanelEvents";
import {
  HealthCheckTrackingProvider,
  IssueProvider,
} from "../../hooks/HealthCheckTracking.context";
import type { IHealthCheckEntry } from "../../views/content/types";
import { EntryActions } from "./EntryActions";

vi.mock("react-i18next", () => vi.importActual("@/test-utils/i18nMock"));

const entry: IHealthCheckEntry = {
  id: "uid-42:toggle",
  checkId: "check-file-level-requirements",
  severity: "warning",
  resolutionType: "enable",
  data: {},
};

function renderActions() {
  const emitter = new EventEmitter();
  const events: MixpanelEvent[] = [];
  emitter.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
  const api = { events: emitter } as unknown as IExtensionApi;
  const onNotHelpful = vi.fn();

  render(
    <HealthCheckTrackingProvider api={api}>
      <IssueProvider entry={entry}>
        <EntryActions
          givenFeedback={false}
          variant="detail"
          onHelpful={vi.fn()}
          onNotHelpful={onNotHelpful}
          onToggleHide={vi.fn()}
        />
      </IssueProvider>
    </HealthCheckTrackingProvider>,
  );

  return { events, onNotHelpful };
}

describe("EntryActions feedback analytics", () => {
  it("emits feedback_helpful carrying the ambient issue on thumbs-up", () => {
    const { events } = renderActions();

    fireEvent.click(screen.getByRole("button", { name: "common:::helpful" }));

    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe("health_check_feedback_helpful");
    expect(events[0].properties).toEqual({
      issue_id: "uid-42:toggle",
      check_id: "file_requirements",
      issue_type: "warning",
      resolution_type: "enable",
    });
  });

  it("emits feedback_not_helpful with the reasons on submit", () => {
    const { events, onNotHelpful } = renderActions();

    fireEvent.click(screen.getByRole("button", { name: "common:::not_helpful" }));
    expect(events).toHaveLength(0);

    fireEvent.click(
      screen.getByRole("button", { name: "detail::feedback_modal::buttons::confirm" }),
    );

    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe("health_check_feedback_not_helpful");
    expect(events[0].properties.feedback_reasons).toEqual([]);
    // The owner still persists; only the analytics moved.
    expect(onNotHelpful).toHaveBeenCalledWith([]);
  });

  it("emits feedback_dismissed when the reasons modal is abandoned", () => {
    const { events, onNotHelpful } = renderActions();

    fireEvent.click(screen.getByRole("button", { name: "common:::not_helpful" }));
    fireEvent.click(
      screen.getByRole("button", { name: "detail::feedback_modal::buttons::cancel" }),
    );

    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe("health_check_feedback_dismissed");
    expect(events[0].properties).not.toHaveProperty("resolution_type");
    // Abandoning isn't feedback, so nothing is persisted and the thumbs stay live.
    expect(onNotHelpful).not.toHaveBeenCalled();
  });
});
