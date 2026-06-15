import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { Toolbar } from "./Toolbar";
import { ToolbarGroup, type IToolbarAction } from "./ToolbarGroup";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const makeActions = (count: number): IToolbarAction[] =>
  Array.from({ length: count }, (_, i) => ({ label: `Action ${i + 1}`, iconPath: "mdi-test" }));

const getKebab = () => screen.getByRole("button", { name: /more actions/i });

// --- Tests ---

describe("Toolbar", () => {
  it('renders a container with role="toolbar"', () => {
    render(<Toolbar>content</Toolbar>);
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
  });

  it("renders its children", () => {
    render(
      <Toolbar>
        <span data-testid="child" />
      </Toolbar>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("merges custom className with the base class", () => {
    render(<Toolbar className="my-class">content</Toolbar>);
    expect(screen.getByRole("toolbar")).toHaveClass("nxm-toolbar", "my-class");
  });

  it("passes through arbitrary HTML attributes", () => {
    render(<Toolbar data-testid="bar">content</Toolbar>);
    expect(screen.getByTestId("bar")).toBeInTheDocument();
  });
});

describe("ToolbarGroup", () => {
  describe("rendering", () => {
    it("renders one button per action when under the limit", () => {
      render(<ToolbarGroup actions={makeActions(3)} />);
      expect(screen.getAllByRole("button")).toHaveLength(3);
      expect(screen.getByRole("button", { name: "Action 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Action 3" })).toBeInTheDocument();
    });

    it("renders an icon-only button (label as aria-label, not visible text)", () => {
      render(<ToolbarGroup actions={[{ label: "Refresh", iconPath: "mdi-test" }]} />);
      expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
      expect(screen.queryByText("Refresh")).not.toBeInTheDocument();
    });

    it("renders visible label text when showLabel is set", () => {
      render(<ToolbarGroup actions={[{ label: "1 selected", showLabel: true }]} />);
      expect(screen.getByText("1 selected")).toBeInTheDocument();
    });

    it("defaults actions to the neutral brand", () => {
      render(<ToolbarGroup actions={[{ label: "Plain", iconPath: "mdi-test" }]} />);
      expect(screen.getByRole("button", { name: "Plain" })).toHaveClass("nxm-button-neutral");
    });

    it("applies a custom brand", () => {
      render(<ToolbarGroup actions={[{ label: "Info", iconPath: "mdi-test", brand: "info" }]} />);
      expect(screen.getByRole("button", { name: "Info" })).toHaveClass("nxm-button-info");
    });

    it("merges custom className with the base group class", () => {
      const { container } = render(<ToolbarGroup actions={makeActions(1)} className="my-group" />);
      expect(container.firstChild).toHaveClass("nxm-toolbar-group", "my-group");
    });
  });

  describe("interactions", () => {
    it("calls an action's onClick when its button is clicked", async () => {
      const onClick = vi.fn();
      render(<ToolbarGroup actions={[{ label: "Go", iconPath: "mdi-test", onClick }]} />);
      await userEvent.click(screen.getByRole("button", { name: "Go" }));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it("disables a button and suppresses its onClick when the action is disabled", async () => {
      const onClick = vi.fn();
      render(
        <ToolbarGroup
          actions={[{ label: "Nope", iconPath: "mdi-test", onClick, disabled: true }]}
        />,
      );
      const button = screen.getByRole("button", { name: "Nope" });
      expect(button).toBeDisabled();
      await userEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("overflow", () => {
    it("does not render a kebab when the action count is within maxVisible", () => {
      render(<ToolbarGroup actions={makeActions(7)} />);
      expect(screen.getAllByRole("button")).toHaveLength(7);
      expect(screen.queryByRole("button", { name: /more actions/i })).not.toBeInTheDocument();
    });

    it("collapses the tail into a kebab once maxVisible is exceeded", () => {
      render(<ToolbarGroup actions={makeActions(8)} />);
      // 6 visible action buttons + the kebab = 7 slots.
      expect(screen.getAllByRole("button")).toHaveLength(7);
      expect(screen.getByRole("button", { name: "Action 6" })).toBeInTheDocument();
      expect(getKebab()).toBeInTheDocument();
      // Overflow actions are not rendered until the menu opens.
      expect(screen.queryByText("Action 7")).not.toBeInTheDocument();
      expect(screen.queryByText("Action 8")).not.toBeInTheDocument();
    });

    it("reveals the overflow actions when the kebab is opened", async () => {
      render(<ToolbarGroup actions={makeActions(8)} />);
      await userEvent.click(getKebab());
      expect(screen.getByText("Action 7")).toBeInTheDocument();
      expect(screen.getByText("Action 8")).toBeInTheDocument();
    });

    it("calls an overflowed action's onClick from the dropdown", async () => {
      const onClick = vi.fn();
      const actions = [...makeActions(7), { label: "Overflowed", iconPath: "mdi-test", onClick }];
      render(<ToolbarGroup actions={actions} />);
      await userEvent.click(getKebab());
      await userEvent.click(screen.getByText("Overflowed"));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it("respects a custom maxVisible", () => {
      render(<ToolbarGroup actions={makeActions(5)} maxVisible={3} />);
      // 2 visible action buttons + the kebab = 3 slots.
      expect(screen.getAllByRole("button")).toHaveLength(3);
      expect(screen.getByRole("button", { name: "Action 2" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Action 3" })).not.toBeInTheDocument();
      expect(getKebab()).toBeInTheDocument();
    });

    it("never collapses when maxVisible is null", () => {
      render(<ToolbarGroup actions={makeActions(10)} maxVisible={null} />);
      expect(screen.getAllByRole("button")).toHaveLength(10);
      expect(screen.queryByRole("button", { name: /more actions/i })).not.toBeInTheDocument();
    });
  });
});
