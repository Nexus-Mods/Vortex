import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

import DraggableItem from "./DraggableListItem";

type Dragged = { index: number; items: unknown[]; containerId: string };
type Monitor = {
  isOver: (options: { shallow: boolean }) => boolean;
  getClientOffset: () => { x: number; y: number };
};
const hooks = vi.hoisted(() => ({
  hover: undefined as undefined | ((item: Dragged, monitor: Monitor) => void),
}));
vi.mock("react-dnd", () => ({
  useDrag: () => [{ isDraggingItem: false }, (node: unknown) => node, (node: unknown) => node],
  useDrop: (spec: { hover: typeof hooks.hover }) => {
    hooks.hover = spec.hover;
    return [{}, (node: unknown) => node];
  },
}));
const Row = () => <div data-testid="drag-row" />;

describe("draggable row hover", () => {
  test.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])("keeps the configured hover behavior (direct=%s, shallow=%s)", (direct, shallow) => {
    const onChangeIndex = vi.fn();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 40,
      left: 0,
      right: 200,
      width: 200,
      height: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    render(
      <DraggableItem
        index={0}
        reorderOnDirectHover={direct}
        item={{ id: "first" }}
        isLocked={false}
        itemRenderer={Row}
        containerId="test"
        isSelected={false}
        selectedItems={[]}
        draggedItems={[]}
        apply={vi.fn()}
        findItemIndex={() => 1}
        take={(item) => item}
        onClick={vi.fn()}
        onDragStart={vi.fn()}
        onChangeIndex={onChangeIndex}
      />,
    );
    const dragged = { index: 1, items: [{ id: "second" }], containerId: "test" };
    hooks.hover(dragged, { isOver: () => shallow, getClientOffset: () => ({ x: 20, y: 8 }) });
    if (shallow === direct) {
      expect(onChangeIndex).toHaveBeenCalledWith(1, 0, false, expect.any(Function));
      expect(dragged.index).toBe(0);
    } else {
      expect(onChangeIndex).not.toHaveBeenCalled();
      expect(dragged.index).toBe(1);
    }
  });
});
