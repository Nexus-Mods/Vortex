/**
 * Tests for the list layout's game row reporting its actions: the row's own buttons
 * report as its lead action, the ones in its details popover as menu rows.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as PropTypes from "prop-types";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IActionDefinition } from "../../../types/IActionDefinition";
import type { IGameStored } from "../types/IGameStored";

const { bars, emit } = vi.hoisted(() => ({
  bars: [] as Array<{
    filter: (action: IActionDefinition) => boolean;
    onAction?: (action: IActionDefinition, index: number) => void;
  }>,
  emit: vi.fn<(...args: unknown[]) => void>(),
}));

// Each IconBar is recorded so a test can play one of its actions being run. The menu bar
// draws the Hide toggle, a registered component, as HideGameIcon's button does.
vi.mock("../../../controls/IconBar", () => ({
  default: (props: (typeof bars)[number] & { instanceId: string }) => {
    bars.push(props);
    return props.filter({ position: 100 } as IActionDefinition) ? (
      <button id={`hide-${props.instanceId}`} type="button" />
    ) : null;
  },
}));

// The popover's panel holds the menu's IconBar; rendered open so it mounts.
vi.mock("@/ui/components/popover/Popover", () => ({
  Popover: ({ children }: { children: (state: { open: boolean }) => React.ReactNode }) => (
    <>{children({ open: true })}</>
  ),
}));
vi.mock("@/ui/components/popover/PopoverButton", () => ({ PopoverButton: () => null }));
vi.mock("@/ui/components/popover/PopoverPanel", () => ({
  PopoverPanel: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/ui/components/image/Image", () => ({ Image: () => null }));
vi.mock("../components/TierZeroIndicator", () => ({ TierZeroRowBadge: () => null }));
vi.mock("./GameInfoPopover", () => ({ default: () => null }));
vi.mock("../util/gameArtURL", () => ({ gameArtURL: () => undefined }));
vi.mock("@/extensions/analytics/mixpanel/numericGameId", () => ({
  numericNexusGameId: () => 1704,
}));

import GameRow from "./GameRow";

/** GameRow reads the api off the legacy context, as every ComponentEx does. */
class LegacyContext extends React.Component<{ children: React.ReactNode }> {
  public static childContextTypes = { api: PropTypes.object };

  public getChildContext() {
    // The popover puts its IconBar under a redux Provider, which wants a whole store.
    const store = { dispatch: vi.fn(), getState: () => ({}), subscribe: () => () => undefined };
    return { api: { events: { emit }, store } };
  }

  public render() {
    return this.props.children;
  }
}

const skyrim: IGameStored = {
  id: "skyrimse",
  name: "Skyrim Special Edition",
  executable: undefined,
  extensionPath: undefined,
  requiredFiles: [],
};

const renderRow = (props: Partial<React.ComponentProps<typeof GameRow>> = {}) =>
  render(
    <LegacyContext>
      <GameRow
        active={false}
        game={skyrim}
        section="detected"
        source="detected_list"
        t={((input: string) => input) as never}
        type="unmanaged"
        onBrowseGameLocation={vi.fn()}
        onRefreshGameInfo={vi.fn()}
        {...props}
      />
    </LegacyContext>,
  );

const tracked = () =>
  emit.mock.calls
    .filter(([event]) => event === "analytics-track-mixpanel-event")
    .map(([, payload]) => payload);

// The row's own buttons are the ones its filter lets below the menu split.
const leadBar = () => bars.find((bar) => bar.filter({ position: 50 } as IActionDefinition));
const menuBar = () => bars.find((bar) => !bar.filter({ position: 50 } as IActionDefinition));

describe("GameRow", () => {
  beforeEach(() => {
    bars.length = 0;
    emit.mockReset();
  });

  it("reports its own button as the section's lead action", () => {
    renderRow({ discovery: { path: "C:/Games/Skyrim", store: "steam" } });

    leadBar()?.onAction?.({ title: "Manage", position: 50 } as IActionDefinition, 0);

    expect(tracked()).toEqual([
      {
        eventName: "app_game_tile_action_clicked",
        properties: {
          section: "detected",
          layout: "list",
          placement: "primary",
          action: "add_game",
          game_id: 1704,
          game_store: "steam",
        },
      },
    ]);
  });

  it("names the detected store for a game discovery hasn't found, as its tile does", () => {
    renderRow({ detectedStore: "epic" });

    leadBar()?.onAction?.({ title: "Manage", position: 50 } as IActionDefinition, 0);

    expect(tracked()).toEqual([
      expect.objectContaining({ properties: expect.objectContaining({ game_store: "epic" }) }),
    ]);
  });

  it("reports a lead button after the first by its registered title, as a tile's menu does", () => {
    renderRow();

    leadBar()?.onAction?.({ title: "Install Extension", position: 60 } as IActionDefinition, 1);

    expect(tracked()).toEqual([
      expect.objectContaining({
        properties: expect.objectContaining({ placement: "primary", action: "Install Extension" }),
      }),
    ]);
  });

  it.each([
    [false, "hide"],
    [true, "show"],
  ])(
    "reports the popover's Hide toggle on a game hidden: %s as %s, as a tile's menu does",
    async (hidden, action) => {
      renderRow({ discovery: { path: "C:/Games/Skyrim", store: "steam", hidden } });

      await userEvent.click(screen.getByRole("button"));

      expect(tracked()).toEqual([
        expect.objectContaining({
          properties: expect.objectContaining({ placement: "menu", action }),
        }),
      ]);
    },
  );

  it("reports a popover action as a menu row, by its registered title", () => {
    renderRow({ section: "added", source: undefined, type: "managed" });

    menuBar()?.onAction?.({ title: "Stop Managing", position: 150 } as IActionDefinition, 2);

    expect(tracked()).toEqual([
      {
        eventName: "app_game_tile_action_clicked",
        properties: {
          section: "added",
          layout: "list",
          placement: "menu",
          action: "Stop Managing",
          game_id: 1704,
          game_store: null,
        },
      },
    ]);
  });
});
