import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { makeLoadOrderEntry } from "../test-utils/builders";
import DraggableList from "./DraggableList";

// --- Helpers ---

// ListWindow creates a ResizeObserver on attach; happy-dom does not provide one.
beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    public observe(): void {}
    public unobserve(): void {}
    public disconnect(): void {}
  };
});

afterEach(() => {
  cleanup();
});

const Row: React.FC<{ item: { id: string } }> = ({ item }) => (
  <div data-testid="lo-row">{item.id}</div>
);

const renderComponent = (itemCount: number, virtualized: boolean) => {
  const items = Array.from({ length: itemCount }, () => makeLoadOrderEntry());

  render(
    <DndProvider backend={HTML5Backend}>
      <DraggableList
        id="test-lo"
        itemTypeId="test-lo-item"
        items={items}
        itemRenderer={Row as React.ComponentType<{ item: any }>}
        idFunc={(item) => item.id}
        apply={() => undefined}
        virtualized={virtualized}
      />
    </DndProvider>,
  );

  return { items };
};

const rowCount = () => screen.queryAllByTestId("lo-row").length;

// --- Tests ---

describe("DraggableList virtualization", () => {
  it("renders only a window of rows for a large virtualized list", () => {
    renderComponent(1000, true);
    expect(rowCount()).toBeGreaterThan(0);
    expect(rowCount()).toBeLessThan(100);
  });

  it("renders every row when not virtualized", () => {
    renderComponent(1000, false);
    expect(rowCount()).toBe(1000);
  });
});
