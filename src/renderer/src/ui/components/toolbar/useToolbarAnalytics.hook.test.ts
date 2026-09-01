/**
 * The shape of `toolbar_action_clicked` as it reaches the generic Mixpanel funnel. The event
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

/** Reports one use of the mods toolbar, and hands back what that put on the wire. */
const report = (action: IToolbarActionIdentity, surface: ToolbarSurface): MixpanelEvent => {
  const { result } = renderHook(() => useToolbarAnalytics("mods"));
  result.current(action, surface);

  const [name, event] = emit.mock.calls.at(-1) ?? [];
  expect(name).toBe("analytics-track-mixpanel-event");

  return event as MixpanelEvent;
};

beforeEach(() => {
  emit.mockClear();
});

describe("useToolbarAnalytics", () => {
  it("reports the action, its toolbar and where it was reached from", () => {
    const event = report({ id: "deploy-mods" }, "bar");

    expect(event.eventName).toBe("toolbar_action_clicked");
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
});
