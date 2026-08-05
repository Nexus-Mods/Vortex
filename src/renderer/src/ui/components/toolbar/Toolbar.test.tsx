import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";

import { Toolbar } from "./Toolbar";
import { ToolbarGroup, type IToolbarAction } from "./ToolbarGroup";
import { fitVisibleCount, type IToolbarGroupMetrics } from "./useToolbarOverflow.hook";

// --- Helpers ---

const makeActions = (count: number): IToolbarAction[] =>
  Array.from({ length: count }, (_, i) => ({ label: `Action ${i + 1}`, iconPath: "mdi-test" }));

const getKebab = () => screen.getByRole("button", { name: /more actions/i });

const countActionButtons = () =>
  screen
    .getAllByRole("button")
    .filter((button) => !/more actions/i.test(button.getAttribute("aria-label") ?? "")).length;

/**
 * happy-dom lays nothing out, so every control reports a width of 0. These stubs
 * stand in for a real layout: a uniform width per control and a row width the
 * test drives.
 */
const CONTROL_WIDTH = 28;

let rowWidth = 0;
const resizeCallbacks: Array<() => void> = [];

// Captured before anything is stubbed so each test can hand the environment's
// own definitions back, wherever on the prototype chain they came from.
const nativeWidths = (["offsetWidth", "clientWidth"] as const).map((property) => ({
  property,
  descriptor: Object.getOwnPropertyDescriptor(HTMLElement.prototype, property),
}));

const restoreWidths = () => {
  nativeWidths.forEach(({ descriptor, property }) => {
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, property, descriptor);
    } else {
      delete (HTMLElement.prototype as Partial<HTMLElement>)[property];
    }
  });
};

const stubLayout = (initialRowWidth: number) => {
  rowWidth = initialRowWidth;

  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get(this: HTMLElement) {
      const isControl = this.tagName === "BUTTON" || this.classList.contains("nxm-dropdown");
      return isControl ? CONTROL_WIDTH : 0;
    },
  });

  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains("nxm-toolbar") ? rowWidth : 0;
    },
  });

  vi.stubGlobal(
    "ResizeObserver",
    class {
      public observe = vi.fn();
      public disconnect = vi.fn();

      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
    },
  );
};

const resizeRowTo = (width: number) => {
  rowWidth = width;
  act(() => resizeCallbacks.forEach((callback) => callback()));
};

afterEach(() => {
  resizeCallbacks.length = 0;
  vi.unstubAllGlobals();
  restoreWidths();
});

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
      render(<ToolbarGroup actions={makeActions(7)} maxVisible={7} />);
      expect(screen.getAllByRole("button")).toHaveLength(7);
      expect(screen.queryByRole("button", { name: /more actions/i })).not.toBeInTheDocument();
    });

    it("collapses the tail into a kebab once maxVisible is exceeded", () => {
      render(<ToolbarGroup actions={makeActions(8)} maxVisible={7} />);
      // 6 visible action buttons + the kebab = 7 slots.
      expect(screen.getAllByRole("button")).toHaveLength(7);
      expect(screen.getByRole("button", { name: "Action 6" })).toBeInTheDocument();
      expect(getKebab()).toBeInTheDocument();
      // Overflow actions are not rendered until the menu opens.
      expect(screen.queryByText("Action 7")).not.toBeInTheDocument();
      expect(screen.queryByText("Action 8")).not.toBeInTheDocument();
    });

    it("reveals the overflow actions when the kebab is opened", async () => {
      render(<ToolbarGroup actions={makeActions(8)} maxVisible={7} />);
      await userEvent.click(getKebab());
      expect(screen.getByText("Action 7")).toBeInTheDocument();
      expect(screen.getByText("Action 8")).toBeInTheDocument();
    });

    it("calls an overflowed action's onClick from the dropdown", async () => {
      const onClick = vi.fn();
      const actions = [...makeActions(7), { label: "Overflowed", iconPath: "mdi-test", onClick }];
      render(<ToolbarGroup actions={actions} maxVisible={7} />);
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

    it("never collapses when maxVisible is omitted", () => {
      render(<ToolbarGroup actions={makeActions(10)} />);
      expect(screen.getAllByRole("button")).toHaveLength(10);
      expect(screen.queryByRole("button", { name: /more actions/i })).not.toBeInTheDocument();
    });
  });

  describe("width-based overflow", () => {
    // The stubs give every control a 28px width with no gap or padding, so a row
    // of N pixels holds floor(N / 28) controls — the kebab being one of them.
    const renderRow = (rowPixels: number, actionCount = 5) => {
      stubLayout(rowPixels);
      render(
        <Toolbar>
          <ToolbarGroup actions={makeActions(actionCount)} />
        </Toolbar>,
      );
    };

    it("keeps every action when the row has room for them all", () => {
      renderRow(200);
      expect(countActionButtons()).toBe(5);
      expect(screen.queryByRole("button", { name: /more actions/i })).not.toBeInTheDocument();
    });

    it("collapses the actions that don't fit, leaving room for the kebab", () => {
      renderRow(100);
      // 5 actions need 140px. Two actions plus the kebab is 84px; three would be 112px.
      expect(countActionButtons()).toBe(2);
      expect(getKebab()).toBeInTheDocument();
    });

    it("puts the actions that didn't fit into the kebab's dropdown", async () => {
      renderRow(100);
      await userEvent.click(getKebab());
      expect(screen.getByText("Action 3")).toBeInTheDocument();
      expect(screen.getByText("Action 5")).toBeInTheDocument();
    });

    it("collapses further as the row narrows", () => {
      renderRow(200);
      expect(countActionButtons()).toBe(5);

      resizeRowTo(100);
      expect(countActionButtons()).toBe(2);
    });

    it("restores the collapsed actions when the row grows again", () => {
      renderRow(100);
      expect(countActionButtons()).toBe(2);

      resizeRowTo(200);
      expect(countActionButtons()).toBe(5);
      expect(screen.queryByRole("button", { name: /more actions/i })).not.toBeInTheDocument();
    });

    it("shows only the kebab when not even one action fits", () => {
      renderRow(40);
      expect(countActionButtons()).toBe(0);
      expect(getKebab()).toBeInTheDocument();
    });

    it("still honours maxVisible as a ceiling on a wide row", () => {
      stubLayout(1000);
      render(
        <Toolbar>
          <ToolbarGroup actions={makeActions(10)} maxVisible={4} />
        </Toolbar>,
      );
      expect(countActionButtons()).toBe(3);
      expect(getKebab()).toBeInTheDocument();
    });
  });
});

describe("fitVisibleCount", () => {
  // A mixed row: four icon-only controls and one wide labelled one.
  const metrics: IToolbarGroupMetrics = {
    itemWidths: [28, 28, 28, 92, 28],
    kebabWidth: 28,
    gap: 8,
    padding: 8,
  };

  const fit = (availableWidth: number | null, maxVisible?: number) =>
    fitVisibleCount({
      actionCount: metrics.itemWidths.length,
      availableWidth,
      maxVisible,
      metrics,
    });

  it("shows everything when it all fits", () => {
    // 204px of controls + 32px of gaps + 8px of padding = 244px.
    expect(fit(300)).toBe(5);
    expect(fit(244)).toBe(5);
  });

  it("drops actions one at a time as the budget tightens", () => {
    expect(fit(243)).toBe(3); // 4 actions include the 92px one, so it skips straight to 3.
    expect(fit(144)).toBe(3);
    expect(fit(143)).toBe(2);
    expect(fit(100)).toBe(1);
  });

  it("keeps only the kebab when nothing fits alongside it", () => {
    expect(fit(50)).toBe(0);
    expect(fit(0)).toBe(0);
  });

  it("ignores width when it hasn't been measured", () => {
    expect(fit(null)).toBe(5);
    expect(fit(null, 3)).toBe(2);
  });

  it("takes whichever of width and maxVisible is more restrictive", () => {
    expect(fit(300, 3)).toBe(2); // The cap wins: 2 actions plus the kebab is 3 slots.
    expect(fit(100, 3)).toBe(1); // The width wins.
  });

  it("treats missing metrics as unconstrained", () => {
    expect(fitVisibleCount({ actionCount: 5, availableWidth: 10, metrics: null })).toBe(5);
  });
});
