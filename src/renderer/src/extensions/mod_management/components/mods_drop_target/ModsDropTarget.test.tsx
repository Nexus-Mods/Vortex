import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  webUtils: { getPathForFile: (file: File) => `C:\\drop\\${file.name}` },
}));

import { ModsDropTarget } from "./ModsDropTarget";

const fileDrag = (files: File[] = []) => ({
  dataTransfer: { types: ["Files"], files, dropEffect: "none" },
});

/** What react-dnd's HTML5 backend sends for a drag that starts inside the app. */
const internalDrag = () => ({
  dataTransfer: { types: ["text/plain"], files: [], dropEffect: "none" },
});

const renderTarget = (onDropFiles = vi.fn()) => {
  render(
    <ModsDropTarget onDropFiles={onDropFiles}>
      <div data-testid="row">row</div>
    </ModsDropTarget>,
  );
  return {
    onDropFiles,
    target: screen.getByTestId("mods-drop-target"),
    row: screen.getByTestId("row"),
  };
};

const overlay = () => screen.queryByTestId("mods-drop-overlay");

describe("ModsDropTarget", () => {
  it("shows the overlay while files are dragged over the page and hides it when they leave", () => {
    const { target } = renderTarget();

    fireEvent.dragEnter(target, fileDrag());
    expect(overlay()).toBeInTheDocument();

    fireEvent.dragLeave(target, fileDrag());
    expect(overlay()).not.toBeInTheDocument();
  });

  it("keeps the overlay up while the pointer moves between elements on the page", () => {
    const { target, row } = renderTarget();

    fireEvent.dragEnter(target, fileDrag());
    // Entering a child fires before leaving its parent.
    fireEvent.dragEnter(row, fileDrag());
    fireEvent.dragLeave(target, fileDrag());

    expect(overlay()).toBeInTheDocument();
  });

  it("ignores drags that start inside the app", () => {
    const { target } = renderTarget();

    fireEvent.dragEnter(target, internalDrag());

    expect(overlay()).not.toBeInTheDocument();
  });

  it("hands the dropped files' paths over and hides the overlay", () => {
    const { target, row, onDropFiles } = renderTarget();
    const files = [new File([""], "a.7z"), new File([""], "b.zip")];

    fireEvent.dragEnter(target, fileDrag(files));
    fireEvent.dragEnter(row, fileDrag(files));
    fireEvent.drop(row, fileDrag(files));

    expect(onDropFiles).toHaveBeenCalledWith(["C:\\drop\\a.7z", "C:\\drop\\b.zip"]);
    expect(overlay()).not.toBeInTheDocument();
  });

  it("hides the overlay when a drag is cancelled without a final leave", () => {
    const { target } = renderTarget();

    fireEvent.dragEnter(target, fileDrag());
    fireEvent.dragEnd(window);

    expect(overlay()).not.toBeInTheDocument();
  });
});
