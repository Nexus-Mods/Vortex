import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** The context values under test, set per case. */
const context = vi.hoisted(() => ({
  menuIsCollapsed: false,
  needToDeploy: false,
  autoDeploy: false,
  isDeploying: false,
  deployProgress: 0,
  deployStep: undefined as string | undefined,
  deploy: vi.fn(),
  handlePlay: vi.fn(),
  primaryStarter: undefined as unknown,
  visibleTools: [{ id: "tool-1", exePath: "a.exe" }] as unknown[],
}));

vi.mock("@/contexts", () => ({
  useWindowContext: () => ({ menuIsCollapsed: context.menuIsCollapsed }),
}));

vi.mock("@/views/components/Spine/SpineContext", () => ({
  useSpineContext: () => ({ selection: { type: "game", gameId: "stardewvalley" } }),
}));

vi.mock("../../context/ToolsContext", () => ({
  useToolsContext: () => ({
    gameId: "stardewvalley",
    gameName: "Stardew Valley",
    visibleTools: context.visibleTools,
    primaryStarter: context.primaryStarter,
    primaryToolId: context.primaryStarter ? "tool-1" : undefined,
    isPrimaryRunning: false,
    exclusiveRunning: false,
    isToolRunning: () => false,
    startTool: vi.fn(),
    handlePlay: context.handlePlay,
  }),
}));

vi.mock("@/extensions/mod_management/hooks/useDeployMods.hook", () => ({
  useDeployMods: () => ({
    needToDeploy: context.needToDeploy,
    autoDeploy: context.autoDeploy,
    isDeploying: context.isDeploying,
    deployProgress: context.isDeploying ? context.deployProgress : undefined,
    deployStep: context.isDeploying ? context.deployStep : undefined,
    deploy: context.deploy,
  }),
}));

vi.mock("../ToolButton", () => ({
  ToolButton: () => <button data-testid="tool" type="button" />,
}));

import { settleTransitions } from "@/test-utils/transitions";

import { GameActions } from "./GameActions";

describe("GameActions", () => {
  beforeEach(() => {
    context.menuIsCollapsed = false;
    context.needToDeploy = false;
    context.autoDeploy = false;
    context.isDeploying = false;
    context.deployStep = undefined;
    context.deploy = vi.fn();
    context.handlePlay = vi.fn();
    context.primaryStarter = undefined;
    context.visibleTools = [{ id: "tool-1", exePath: "a.exe" }];
  });

  it("lays the row out for the width the menu is at", async () => {
    const { rerender } = render(<GameActions />);

    expect(screen.getByTestId("menu-tools")).toHaveClass("w-full");

    context.menuIsCollapsed = true;
    rerender(<GameActions />);

    expect(screen.getByTestId("menu-tools")).toHaveClass("w-10");

    await settleTransitions();
  });

  // The entry animation is replayed by remounting on the width change, which is what
  // lets Transition own the sequencing instead of a flag cleared by a timer. If the key
  // stopped changing the row would sit still, so this pins the mechanism rather than the
  // animation.
  it("remounts the row when the menu changes width", async () => {
    const { rerender } = render(<GameActions />);
    const before = screen.getByTestId("menu-tools");

    context.menuIsCollapsed = true;
    rerender(<GameActions />);

    expect(screen.getByTestId("menu-tools")).not.toBe(before);

    await settleTransitions();
  });

  it("keeps the same row when nothing about the width changed", async () => {
    const { rerender } = render(<GameActions />);
    const before = screen.getByTestId("menu-tools");

    rerender(<GameActions />);

    expect(screen.getByTestId("menu-tools")).toBe(before);

    await settleTransitions();
  });

  it("leaves the row out when the game has no tools", () => {
    context.visibleTools = [];

    render(<GameActions />);

    expect(screen.queryByTestId("menu-tools")).toBeNull();
  });

  it("shows Apply only while there is something to deploy, and deploys on click", async () => {
    const { rerender } = render(<GameActions />);

    expect(screen.queryByTestId("menu-apply")).toBeNull();
    expect(screen.getByText("Play")).toBeInTheDocument();

    context.needToDeploy = true;
    rerender(<GameActions />);

    fireEvent.click(screen.getByTestId("menu-apply"));
    expect(context.deploy).toHaveBeenCalledOnce();

    await settleTransitions();
  });

  it("puts Play before Apply and drops Play's label while Apply is showing", async () => {
    context.needToDeploy = true;

    render(<GameActions />);

    const play = screen.getByRole("button", { name: /^Play/ });
    const apply = screen.getByTestId("menu-apply");

    expect(screen.queryByText("Play")).toBeNull();
    expect(apply).toHaveTextContent("Apply");
    expect(play.compareDocumentPosition(apply) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await settleTransitions();
  });

  it("makes both icon only when the menu is collapsed", async () => {
    context.menuIsCollapsed = true;
    context.needToDeploy = true;

    render(<GameActions />);

    expect(screen.getByRole("button", { name: /^Play/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).not.toHaveTextContent("Apply");

    await settleTransitions();
  });

  it("disables Play while a deployment is running", async () => {
    context.primaryStarter = { id: "tool-1", name: "Stardew Valley", exePath: "a.exe" };
    const { rerender } = render(<GameActions />);

    expect(screen.getByRole("button", { name: /^Play/ })).toHaveAttribute("aria-disabled", "false");

    context.isDeploying = true;
    rerender(<GameActions />);

    // aria-disabled, not disabled, so it still gets the hover its tooltip needs.
    const play = screen.getByRole("button", { name: /^Play/ });
    expect(play).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(play);
    expect(context.handlePlay).not.toHaveBeenCalled();

    await settleTransitions();
  });

  it("turns Apply into a progress bar while deploying, so it can't start a second one", async () => {
    context.needToDeploy = true;
    context.isDeploying = true;
    context.deployProgress = 42;

    render(<GameActions />);

    // A progress bar in the button's place, not a button, so there's nothing to press.
    const apply = screen.getByRole("progressbar", { name: "Applying" });
    expect(apply).toHaveAttribute("aria-valuenow", "42");
    expect(screen.queryByRole("button", { name: /Appl/ })).toBeNull();

    fireEvent.click(apply);
    expect(context.deploy).not.toHaveBeenCalled();

    await settleTransitions();
  });

  it("names the step it's on in the progress bar's tooltip", async () => {
    context.needToDeploy = true;
    context.isDeploying = true;
    context.deployStep = "SkyUI";
    render(<GameActions />);

    await userEvent.hover(screen.getByRole("progressbar"));

    expect(await screen.findByText("Applying mod changes:")).toBeInTheDocument();
    expect(screen.getByText("SkyUI")).toBeInTheDocument();

    await settleTransitions();
  });

  it("keeps the tooltip up through the click that starts applying", async () => {
    context.needToDeploy = true;
    const { rerender } = render(<GameActions />);
    const apply = screen.getByTestId("menu-apply");
    await userEvent.hover(apply);
    await screen.findByText("Apply your mod changes to the game");

    // A press only: a full click also focuses, and jsdom counts that as keyboard focus.
    fireEvent.pointerDown(apply);
    context.isDeploying = true;
    context.deployStep = "SkyUI";
    rerender(<GameActions />);
    // Longer than a closing tooltip takes to leave, so a closed one can't pass for open.
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));

    expect(screen.getByText("SkyUI")).toBeInTheDocument();

    await settleTransitions();
  });

  it("keeps the plain tooltip until there's a step to name", async () => {
    context.needToDeploy = true;
    context.isDeploying = true;
    render(<GameActions />);

    await userEvent.hover(screen.getByRole("progressbar"));

    expect(await screen.findByText("Applying mod changes…")).toBeInTheDocument();

    await settleTransitions();
  });

  it("with auto deploy on, skips the clickable Apply and only shows it while deploying", async () => {
    context.autoDeploy = true;
    context.needToDeploy = true;
    const { rerender } = render(<GameActions />);

    expect(screen.queryByTestId("menu-apply")).toBeNull();
    expect(screen.getByText("Play")).toBeInTheDocument();

    context.isDeploying = true;
    context.deployProgress = 10;
    rerender(<GameActions />);

    expect(screen.getByRole("progressbar", { name: "Applying" })).toBeInTheDocument();

    await settleTransitions();
  });
});
