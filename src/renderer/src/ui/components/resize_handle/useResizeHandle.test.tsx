import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { useResizeHandle } from "./useResizeHandle.hook";

const Handle = ({
  onChange,
  onReset,
  onDrag,
  dragMax,
}: {
  onChange: (value: number) => void;
  onReset: () => void;
  onDrag: (value: number | undefined) => void;
  dragMax?: number;
}) => {
  const handle = useResizeHandle({
    value: 100,
    min: 50,
    max: 300,
    dragMax,
    step: 10,
    round: Math.round,
    dragTo: (clientX, start) => start.value + clientX - start.clientX,
    onChange,
    onReset,
    onDrag,
  });

  return (
    <div
      aria-valuenow={handle.value}
      data-dragging={handle.dragging || undefined}
      role="separator"
      tabIndex={0}
      {...handle.handleProps}
    />
  );
};

const renderHandle = (dragMax?: number) => {
  const onChange = vi.fn();
  const onReset = vi.fn();
  const onDrag = vi.fn();
  render(<Handle dragMax={dragMax} onChange={onChange} onDrag={onDrag} onReset={onReset} />);
  return { handle: screen.getByRole("separator"), onChange, onReset, onDrag };
};

describe("useResizeHandle", () => {
  it("follows a drag, kept in bounds, and hands over where it ended once let go", () => {
    const { handle, onChange, onDrag } = renderHandle();

    fireEvent.pointerDown(handle, { clientX: 0 });
    fireEvent.pointerMove(handle, { clientX: 40.4 });

    expect(handle).toHaveAttribute("aria-valuenow", "140");
    expect(handle).toHaveAttribute("data-dragging");
    expect(onDrag).toHaveBeenLastCalledWith(140);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerMove(handle, { clientX: 500 });
    fireEvent.pointerUp(handle, { clientX: 500 });

    expect(onChange.mock.calls).toEqual([[300]]);
    expect(onDrag).toHaveBeenLastCalledWith(undefined);
    expect(handle).toHaveAttribute("aria-valuenow", "100");
  });

  it("lets a drag go past the most the keys go to, up to its own most", () => {
    const { handle, onChange } = renderHandle(Infinity);

    fireEvent.pointerDown(handle, { clientX: 0 });
    fireEvent.pointerMove(handle, { clientX: 900 });
    fireEvent.pointerUp(handle, { clientX: 900 });

    expect(onChange.mock.calls).toEqual([[1000]]);
  });

  it("keeps a drag that's let go of even where releasing the pointer loses its capture at once", () => {
    const { handle, onChange } = renderHandle();
    handle.releasePointerCapture = () => fireEvent.lostPointerCapture(handle);

    fireEvent.pointerDown(handle, { clientX: 0 });
    fireEvent.pointerMove(handle, { clientX: 40 });
    fireEvent.pointerUp(handle, { clientX: 40 });

    expect(onChange.mock.calls).toEqual([[140]]);
  });

  it("takes focus without scrolling to it when a drag starts", () => {
    const { handle } = renderHandle();
    const focus = vi.spyOn(handle, "focus");

    fireEvent.pointerDown(handle, { clientX: 0 });

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("hands over nothing from a drag that's cancelled, or that didn't move", () => {
    const { handle, onChange, onDrag } = renderHandle();

    fireEvent.pointerDown(handle, { clientX: 0 });
    fireEvent.pointerMove(handle, { clientX: 40 });
    fireEvent.pointerCancel(handle);

    fireEvent.pointerDown(handle, { clientX: 0 });
    fireEvent.lostPointerCapture(handle);

    fireEvent.pointerDown(handle, { clientX: 0 });
    fireEvent.pointerUp(handle, { clientX: 0 });

    expect(onChange).not.toHaveBeenCalled();
    expect(onDrag).toHaveBeenLastCalledWith(undefined);
  });

  it("ignores a drag with any but the main button", () => {
    const { handle, onDrag } = renderHandle();

    fireEvent.pointerDown(handle, { button: 2, clientX: 0 });
    fireEvent.pointerMove(handle, { clientX: 40 });

    expect(onDrag).not.toHaveBeenCalled();
  });

  it("moves a step with Left and Right, to its bounds with Home and End, and ignores modifiers", () => {
    const { handle, onChange } = renderHandle();

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "Home" });
    fireEvent.keyDown(handle, { key: "End" });
    fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true });

    expect(onChange.mock.calls).toEqual([[110], [90], [50], [300]]);
  });

  it("resets on Enter or a double-click", () => {
    const { handle, onReset } = renderHandle();

    fireEvent.keyDown(handle, { key: "Enter" });
    fireEvent.doubleClick(handle);

    expect(onReset).toHaveBeenCalledTimes(2);
  });
});
