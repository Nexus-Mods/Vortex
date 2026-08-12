import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { PopoverPanelGroup } from "@/ui/components/popover/PopoverPanelGroup";
import { PopoverPanelGroupItem } from "@/ui/components/popover/PopoverPanelGroupItem";

import { useDisplayOptionsAction } from "./useDisplayOptionsAction.hook";

// --- Helpers ---

const settingRow = (
  <PopoverPanelGroup>
    <PopoverPanelGroupItem label="Show hidden items">
      <input aria-label="Show hidden items" type="checkbox" />
    </PopoverPanelGroupItem>
  </PopoverPanelGroup>
);

/**
 * The action's panel, rendered the way a toolbar control renders it. The two
 * callbacks are kept distinct so a test can tell which one the panel reached for:
 * from a toolbar button they are the same, but from an overflow row `close` puts
 * away only the panel and leaves the menu behind it standing.
 */
const renderPanel = ({
  canReset,
  onReset = () => {},
}: {
  canReset: boolean;
  onReset?: () => void;
}) => {
  const close = vi.fn();
  const dismiss = vi.fn();
  const { result } = renderHook(() =>
    useDisplayOptionsAction({ canReset, children: settingRow, onReset }),
  );

  render(<>{result.current.panel?.({ close, dismiss })}</>);

  return { action: result.current, close, dismiss };
};

// --- Tests ---

describe("useDisplayOptionsAction", () => {
  it("returns a tune-icon action for the toolbar", () => {
    const { action } = renderPanel({ canReset: false });

    expect(action.label).toBe("Display options");
    expect(action.iconPath).toBeTruthy();
  });

  it("renders the setting rows it was given", () => {
    renderPanel({ canReset: false });
    expect(screen.getByText("Show hidden items")).toBeInTheDocument();
  });

  // Nothing to undo means no link, rather than one that would do nothing.
  it("omits the reset link while everything is at its default", () => {
    renderPanel({ canReset: false });

    expect(screen.queryByText("Reset to default")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".nxm-popover-panel-group")).toHaveLength(1);
  });

  it("offers the reset link once something has been changed", () => {
    renderPanel({ canReset: true });

    expect(screen.getByText("Reset to default")).toBeInTheDocument();
    expect(document.querySelectorAll(".nxm-popover-panel-group")).toHaveLength(2);
  });

  // Resetting is an adjustment like any other row here, so the panel stays put and
  // the rows above it show what changed.
  it("restores the defaults without dismissing anything", async () => {
    const onReset = vi.fn();
    const { close, dismiss } = renderPanel({ canReset: true, onReset });

    await userEvent.click(screen.getByText("Reset to default"));

    expect(onReset).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(dismiss).not.toHaveBeenCalled();
  });
});
