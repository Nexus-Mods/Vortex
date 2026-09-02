import fs from "fs";
import path from "path";

/**
 * The mods toolbar is the one toolbar whose use is counted, so what is checked here is
 * the opt-in itself: that a click on it reaches Mixpanel as `toolbar_action_clicked`, and
 * that the classic bar this page still renders alongside it stays unmeasured.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type * as ReactReduxTypes from "react-redux";
import { describe, expect, it, vi } from "vitest";

import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";

const { actions, emit } = vi.hoisted(() => ({
  actions: { current: [] as IToolbarAction[] },
  emit: vi.fn(),
}));

vi.mock("@/contexts", () => ({ useMainContext: () => ({ api: { events: { emit } } }) }));

/**
 * The mods toolbar offers pinning, so the group takes the path that reads the store.
 * Nothing here is about what the user pinned, so an empty slice will do.
 */
vi.mock("react-redux", async () => ({
  ...(await vi.importActual<typeof ReactReduxTypes>("react-redux")),
  useDispatch: () => vi.fn(),
  useSelector: (selector: (state: unknown) => unknown) => selector({ settings: { toolbars: {} } }),
}));

vi.mock("../hooks/useModToolbarActions.hook", () => ({
  useModToolbarActions: () => actions.current,
}));

import { ModsToolbar } from "./ModsToolbar";

const t = ((key: string) => key) as never;

/** The event the toolbar handed to the generic Mixpanel funnel, if it handed one over. */
const trackedEvent = (): MixpanelEvent | undefined =>
  emit.mock.calls.find(([name]) => name === "analytics-track-mixpanel-event")?.[1];

describe("ModsToolbar", () => {
  it("reports a click on one of its buttons as use of the mods toolbar", async () => {
    // Pinned, because the mods toolbar offers pinning and only pinned actions reach
    // the bar — an unpinned one lives in the kebab and would report `overflow`.
    actions.current = [{ label: "Deploy Mods", id: "deploy", pinned: true, onClick: vi.fn() }];
    render(<ModsToolbar t={t} />);

    await userEvent.click(screen.getByRole("button", { name: "Deploy Mods" }));

    expect(trackedEvent()?.eventName).toBe("toolbar_action_clicked");
    expect(trackedEvent()?.properties).toEqual({
      action: "deploy",
      surface: "bar",
      toolbar: "mods",
    });
  });
});

/**
 * The mods page renders the new toolbar or the classic `IconBar` depending on the UI
 * mode, and only the new one is instrumented — deliberately, so the numbers describe the
 * toolbar being redesigned rather than a mixture of the two.
 *
 * Asserted against the source because there is nothing to observe: the guarantee is that
 * no tracking reaches this file at all, and a test that renders it can only show that
 * none fired on the paths it happened to exercise.
 */
describe("the classic toolbar", () => {
  it("has no tracking of its own", () => {
    const iconBar = fs.readFileSync(
      path.resolve(__dirname, "../../../controls/IconBar.tsx"),
      "utf8",
    );

    expect(iconBar).not.toMatch(/analytics|ToolbarActionClicked|onActionClick/i);
  });
});
