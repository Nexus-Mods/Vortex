import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TableColumnResizer } from "./TableColumnResizer";

/** Renders the handle in a header cell drawn `drawn` px wide, in a table 1000px wide. */
const renderResizer = (drawn = 200) => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: drawn,
  } as DOMRect);

  const onDrag = vi.fn();
  const onResize = vi.fn();
  render(
    <div className="nxm-table">
      <div role="columnheader">
        <TableColumnResizer header="Size" minWidth={80} onDrag={onDrag} onResize={onResize} />
      </div>
    </div>,
  );
  return { handle: screen.getByRole("separator"), onDrag, onResize };
};

describe("TableColumnResizer", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads as a separator whose value is the width its column is drawn at, up to the table's", () => {
    const { handle } = renderResizer();

    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuemin", "80");
    expect(handle).toHaveAttribute("aria-valuenow", "200");
    expect(handle).toHaveAttribute("aria-valuemax", "1000");
    expect(handle).toHaveAttribute("aria-valuetext");
  });

  it("reads as its least while its column is drawn narrower", () => {
    const { handle } = renderResizer(40);

    expect(handle).toHaveAttribute("aria-valuenow", "80");
  });

  it("follows a drag in its value, and hands over the width once it's let go of", () => {
    const { handle, onDrag, onResize } = renderResizer();

    fireEvent.pointerDown(handle, { button: 0, clientX: 100 });
    fireEvent.pointerMove(handle, { clientX: 130 });

    expect(handle).toHaveAttribute("aria-valuenow", "230");
    expect(handle).toHaveAttribute("data-dragging");
    expect(onDrag).toHaveBeenLastCalledWith(230);

    fireEvent.pointerUp(handle, { clientX: 130 });

    expect(onResize.mock.calls).toEqual([[230]]);
    expect(onDrag).toHaveBeenLastCalledWith(undefined);
  });

  it("drags its column wider than the table, reading that width as its most", () => {
    const { handle, onResize } = renderResizer();

    fireEvent.pointerDown(handle, { button: 0, clientX: 100 });
    fireEvent.pointerMove(handle, { clientX: 1100 });

    expect(handle).toHaveAttribute("aria-valuenow", "1200");
    expect(handle).toHaveAttribute("aria-valuemax", "1200");

    fireEvent.pointerUp(handle, { clientX: 1100 });

    expect(onResize.mock.calls).toEqual([[1200]]);
  });

  it("takes its column to the table's width with End, and resets it with Enter or a double-click", () => {
    const { handle, onResize } = renderResizer();

    fireEvent.keyDown(handle, { key: "End" });
    fireEvent.keyDown(handle, { key: "Enter" });
    fireEvent.doubleClick(handle);

    expect(onResize.mock.calls).toEqual([[1000], [undefined], [undefined]]);
  });
});
