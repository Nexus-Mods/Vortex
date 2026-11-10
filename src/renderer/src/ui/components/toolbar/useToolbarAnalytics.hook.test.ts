/**
 * The shape of `app_toolbar_action_clicked` as it reaches the generic Mixpanel funnel. The event
 * carries no game, version or user scope of its own — those are super properties
 * registered elsewhere — so what is asserted here is the whole of what a toolbar
 * contributes.
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";

import type { IToolbarActionIdentity, ToolbarSurface } from "./Toolbar.context";

const { emit } = vi.hoisted(() => ({ emit: vi.fn() }));

vi.mock("@/contexts", () => ({ useMainContext: () => ({ api: { events: { emit } } }) }));

import { useToolbarAnalytics } from "./useToolbarAnalytics.hook";

/** What the last call put on the wire, having checked it went to the generic funnel. */
const lastEvent = (): MixpanelEvent => {
  const [name, event] = emit.mock.calls.at(-1) ?? [];
  expect(name).toBe("analytics-track-mixpanel-event");

  return event as MixpanelEvent;
};

/** Reports one click on the mods toolbar. */
const report = (action: IToolbarActionIdentity, surface: ToolbarSurface): MixpanelEvent => {
  const { result } = renderHook(() => useToolbarAnalytics("mods"));
  result.current.onActionClick(action, surface);

  return lastEvent();
};

/** Reports one pin or unpin on the mods toolbar. */
const reportPin = (action: IToolbarActionIdentity, pinned: boolean): MixpanelEvent => {
  const { result } = renderHook(() => useToolbarAnalytics("mods"));
  result.current.onPinChange(action, pinned);

  return lastEvent();
};

beforeEach(() => {
  emit.mockClear();
});

describe("useToolbarAnalytics", () => {
  it("reports the action, its toolbar and where it was reached from", () => {
    const event = report({ id: "deploy-mods" }, "bar");

    expect(event.eventName).toBe("app_toolbar_action_clicked");
    expect(event.properties).toEqual({ action: "deploy-mods", surface: "bar", toolbar: "mods" });
  });

  it("names the extension an action came from", () => {
    const event = report({ id: "Manage Rules", extension: "mod-dependency-manager" }, "menu");

    expect(event.properties.extension).toBe("mod-dependency-manager");
  });

  // Absent rather than empty, so that the property's presence is itself the answer to
  // "did this button come from an extension?" without having to filter out blanks.
  it("leaves the extension out entirely for a page's own action", () => {
    const event = report({ id: "deploy-mods" }, "bar");

    expect(Object.keys(event.properties)).not.toContain("extension");
  });

  it("adds an action's own properties to its click", () => {
    const event = report({ id: "beta-table", properties: { view: "beta" } }, "bar");

    expect(event.properties).toEqual({
      action: "beta-table",
      surface: "bar",
      toolbar: "mods",
      view: "beta",
    });
  });

  it("keeps an action's own properties from standing in for which button it was", () => {
    const event = report(
      { id: "beta-table", properties: { action: "other", surface: "x" } },
      "bar",
    );

    expect(event.properties).toMatchObject({ action: "beta-table", surface: "bar" });
  });
});

describe("useToolbarAnalytics pin tracking", () => {
  it.each([true, false])("reports the state a pin was moved to (pinned=%s)", (pinned) => {
    const event = reportPin({ id: "deploy" }, pinned);

    expect(event.eventName).toBe("app_toolbar_pin_changed");
    expect(event.properties).toEqual({ action: "deploy", pinned, toolbar: "mods" });
  });

  // What a click says about itself, such as which way a toggle went, means nothing on a pin.
  it("leaves an action's own properties off its pin", () => {
    const event = reportPin({ id: "beta-table", properties: { view: "beta" } }, true);

    expect(event.properties).toEqual({ action: "beta-table", pinned: true, toolbar: "mods" });
  });

  it("names the extension a pinned action came from", () => {
    const event = reportPin({ id: "Manage Rules", extension: "mod-dependency-manager" }, true);

    expect(event.properties.extension).toBe("mod-dependency-manager");
  });

  // No action, because a reset is about the whole toolbar rather than one button.
  it("reports a reset against the toolbar alone", () => {
    const { result } = renderHook(() => useToolbarAnalytics("mods"));
    result.current.onPinsReset();

    const event = lastEvent();

    expect(event.eventName).toBe("app_toolbar_pins_reset");
    expect(event.properties).toEqual({ toolbar: "mods" });
  });
});
