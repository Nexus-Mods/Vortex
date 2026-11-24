import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ResizableSplit } from "./ResizableSplit";

/** Renders a split 1000px wide from x 100, so the pointer's x maps straight onto its share. */
const renderSplit = (split = 0.5) => {
  const onSplitChange = vi.fn();
  const view = render(
    <ResizableSplit
      end={<div>End</div>}
      label="Resize the panes"
      split={split}
      valueText={(percent) => `Start ${percent}%`}
      start={<div>Start</div>}
      onSplitChange={onSplitChange}
    />,
  );
  const container = screen.getByRole("separator").parentElement!;
  container.getBoundingClientRect = () => ({ left: 100, width: 1000 }) as DOMRect;
  return { ...view, onSplitChange, handle: screen.getByRole("separator") };
};

describe("ResizableSplit", () => {
  it("lays out both panes at the split, with a separator that says where it is", () => {
    const { container, handle } = renderSplit(0.4);

    expect(screen.getByText("Start")).toBeTruthy();
    expect(screen.getByText("End")).toBeTruthy();
    expect(
      (container.firstElementChild as HTMLElement).style.getPropertyValue("--nxm-resizable-split"),
    ).toBe("0.4");
    expect(handle.getAttribute("aria-label")).toBe("Resize the panes");
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("aria-valuenow")).toBe("40");
    expect(handle.getAttribute("aria-valuetext")).toBe("Start 40%");
  });

  it("comes between the panes in the Tab order", () => {
    renderSplit();

    const order = [
      screen.getByText("Start"),
      screen.getByRole("separator"),
      screen.getByText("End"),
    ];
    expect(
      order[0].compareDocumentPosition(order[1]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      order[1].compareDocumentPosition(order[2]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("follows the pointer while the handle is dragged, and hands over the split once it's let go", () => {
    const { container, handle, onSplitChange } = renderSplit();

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 600 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 650 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 700 });

    expect(onSplitChange).not.toHaveBeenCalled();
    expect(
      (container.firstElementChild as HTMLElement).style.getPropertyValue("--nxm-resizable-split"),
    ).toBe("0.6");
    expect(handle.getAttribute("aria-valuenow")).toBe("60");

    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 700 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400 });

    expect(onSplitChange.mock.calls).toEqual([[0.6]]);
  });

  it("hands over nothing when the handle is let go where it was picked up", () => {
    const { handle, onSplitChange } = renderSplit();

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 600 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 600 });

    expect(onSplitChange).not.toHaveBeenCalled();
  });

  it("keeps the split between its bounds", () => {
    const { handle, onSplitChange } = renderSplit();

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 600 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 150 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 150 });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 600 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 1050 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 1050 });

    expect(onSplitChange.mock.calls).toEqual([[0.3], [0.7]]);
  });

  it("moves in steps with Left and Right, and to its bounds with Home and End", () => {
    const { handle, onSplitChange } = renderSplit();

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "Home" });
    fireEvent.keyDown(handle, { key: "End" });
    fireEvent.keyDown(handle, { key: "ArrowRight", ctrlKey: true });

    expect(onSplitChange.mock.calls).toEqual([[0.55], [0.45], [0.3], [0.7]]);
  });

  it("goes back to an even split on a double-click, or Enter", () => {
    const { handle, onSplitChange } = renderSplit(0.65);

    fireEvent.doubleClick(handle);
    fireEvent.keyDown(handle, { key: "Enter" });

    expect(onSplitChange.mock.calls).toEqual([[0.5], [0.5]]);
  });
});
