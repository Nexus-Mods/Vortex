import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The context values under test, set per case. */
const context = vi.hoisted(() => ({
  menuIsCollapsed: false,
  visibleTools: [{ id: "tool-1", exePath: "a.exe" }] as unknown[],
}));

vi.mock("@/contexts", () => ({
  useWindowContext: () => ({ menuIsCollapsed: context.menuIsCollapsed }),
}));

vi.mock("../Spine/SpineContext", () => ({
  useSpineContext: () => ({ selection: { type: "game", gameId: "stardewvalley" } }),
}));

vi.mock("./ToolsContext", () => ({
  useToolsContext: () => ({
    gameId: "stardewvalley",
    gameName: "Stardew Valley",
    visibleTools: context.visibleTools,
    primaryStarter: undefined,
    primaryToolId: undefined,
    isPrimaryRunning: false,
    exclusiveRunning: false,
    isToolRunning: () => false,
    startTool: vi.fn(),
    handlePlay: vi.fn(),
  }),
}));

vi.mock("./ToolButton", () => ({
  ToolButton: () => <button data-testid="tool" type="button" />,
}));

import { settleTransitions } from "@/test-utils/transitions";

import { ToolsSection } from "./ToolsSection";

describe("ToolsSection", () => {
  beforeEach(() => {
    context.menuIsCollapsed = false;
    context.visibleTools = [{ id: "tool-1", exePath: "a.exe" }];
  });

  it("lays the row out for the width the menu is at", async () => {
    const { rerender } = render(<ToolsSection />);

    expect(screen.getByTestId("menu-tools")).toHaveClass("w-full");

    context.menuIsCollapsed = true;
    rerender(<ToolsSection />);

    expect(screen.getByTestId("menu-tools")).toHaveClass("w-10");

    await settleTransitions();
  });

  // The entry animation is replayed by remounting on the width change, which is what
  // lets Transition own the sequencing instead of a flag cleared by a timer. If the key
  // stopped changing the row would sit still, so this pins the mechanism rather than the
  // animation.
  it("remounts the row when the menu changes width", async () => {
    const { rerender } = render(<ToolsSection />);
    const before = screen.getByTestId("menu-tools");

    context.menuIsCollapsed = true;
    rerender(<ToolsSection />);

    expect(screen.getByTestId("menu-tools")).not.toBe(before);

    await settleTransitions();
  });

  it("keeps the same row when nothing about the width changed", async () => {
    const { rerender } = render(<ToolsSection />);
    const before = screen.getByTestId("menu-tools");

    rerender(<ToolsSection />);

    expect(screen.getByTestId("menu-tools")).toBe(before);

    await settleTransitions();
  });

  it("leaves the row out when the game has no tools", () => {
    context.visibleTools = [];

    render(<ToolsSection />);

    expect(screen.queryByTestId("menu-tools")).toBeNull();
  });
});
