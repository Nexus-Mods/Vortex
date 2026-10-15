import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  webUtils: { getPathForFile: (file: File) => `C:\\drop\\${file.name}` },
}));

import { DRAG_WATCHDOG_MS, ModsDropTarget } from "./ModsDropTarget";

const fileDrag = (files: File[] = []) => ({
  dataTransfer: { types: ["Files"], files, dropEffect: "none" },
});

/**
 * A file drag leaving `element` for `next`, or for outside the window when `next` is null.
 * happy-dom drops `relatedTarget` from the event init, so it is set on the event itself.
 */
const leave = (element: Element, next: EventTarget | null) => {
  const evt = createEvent.dragLeave(element, fileDrag());
  Object.defineProperty(evt, "relatedTarget", { value: next });
  fireEvent(element, evt);
};

/** What react-dnd's HTML5 backend sends for a drag that starts inside the app. */
const internalDrag = () => ({
  dataTransfer: { types: ["text/plain"], files: [], dropEffect: "none" },
});

/** A row that can be taken away mid-drag, the way a row re-renders when a download finishes. */
let removeRow: () => void = () => undefined;

const Rows = () => {
  const [showRow, setShowRow] = useState(true);
  removeRow = () => setShowRow(false);
  return showRow ? <div data-testid="row">row</div> : null;
};

const renderTarget = (onDropFiles = vi.fn()) => {
  render(
    <ModsDropTarget onDropFiles={onDropFiles}>
      <Rows />
      <div data-testid="other">other</div>
      {createPortal(<div data-testid="tooltip">tooltip</div>, document.body)}
    </ModsDropTarget>,
  );
  return {
    onDropFiles,
    target: screen.getByTestId("mods-drop-target"),
    row: screen.getByTestId("row"),
    other: screen.getByTestId("other"),
    tooltip: screen.getByTestId("tooltip"),
  };
};

const overlay = () => screen.queryByTestId("mods-drop-overlay");

afterEach(() => {
  vi.useRealTimers();
});

describe("ModsDropTarget", () => {
  it("shows the overlay while files are dragged over the page and hides it when they leave", () => {
    const { target } = renderTarget();

    fireEvent.dragEnter(target, fileDrag());
    expect(overlay()).toBeInTheDocument();

    leave(target, null);
    expect(overlay()).not.toBeInTheDocument();
  });

  it("keeps the overlay up while the pointer moves between elements on the page", () => {
    const { row, other } = renderTarget();

    fireEvent.dragEnter(row, fileDrag());
    leave(row, other);

    expect(overlay()).toBeInTheDocument();
  });

  it("hides the overlay on leaving the page even when a row went away mid-drag", () => {
    const { row, target } = renderTarget();

    // The pointer enters the page, then a row on it.
    fireEvent.dragEnter(target, fileDrag());
    fireEvent.dragEnter(row, fileDrag());
    // The row unmounts without ever sending its leave.
    act(() => removeRow());
    leave(target, null);

    expect(overlay()).not.toBeInTheDocument();
  });

  it("ignores drags that start inside the app", () => {
    const { target } = renderTarget();

    fireEvent.dragEnter(target, internalDrag());

    expect(overlay()).not.toBeInTheDocument();
  });

  it("hands the dropped files' paths over and hides the overlay", () => {
    const { row, onDropFiles } = renderTarget();
    const files = [new File([""], "a.7z"), new File([""], "b.zip")];

    fireEvent.dragEnter(row, fileDrag(files));
    fireEvent.drop(row, fileDrag(files));

    expect(onDropFiles).toHaveBeenCalledWith(["C:\\drop\\a.7z", "C:\\drop\\b.zip"]);
    expect(overlay()).not.toBeInTheDocument();
  });

  it("stays up while a held drag keeps sending dragover, and goes once they stop", () => {
    vi.useFakeTimers();
    const { row } = renderTarget();

    fireEvent.dragEnter(row, fileDrag());
    for (let i = 0; i < 5; i++) {
      act(() => vi.advanceTimersByTime(DRAG_WATCHDOG_MS / 2));
      fireEvent.dragOver(row, fileDrag());
    }
    expect(overlay()).toBeInTheDocument();

    // A drag cancelled with Esc from outside the app sends no dragend and no further dragover.
    act(() => vi.advanceTimersByTime(DRAG_WATCHDOG_MS));
    expect(overlay()).not.toBeInTheDocument();
  });

  it("does not show the overlay or take a drop on content portalled out of the page", () => {
    const { tooltip, onDropFiles } = renderTarget();
    const files = [new File([""], "a.7z")];

    fireEvent.dragEnter(tooltip, fileDrag(files));
    expect(overlay()).not.toBeInTheDocument();

    fireEvent.drop(tooltip, fileDrag(files));
    expect(onDropFiles).not.toHaveBeenCalled();
  });
});
