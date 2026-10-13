import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { type MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { ContextMenu, contextMenuPosition, type IContextMenuPosition } from "./ContextMenu";

const renderMenu = (position: IContextMenuPosition | undefined, onClose = vi.fn()) => {
  render(
    <ContextMenu position={position} onClose={onClose}>
      {(close) => (
        <button type="button" onClick={close}>
          Rename
        </button>
      )}
    </ContextMenu>,
  );
  return onClose;
};

describe("ContextMenu", () => {
  it("shows its content while it has a position, and nothing without", () => {
    const { unmount } = render(
      <ContextMenu position={undefined} onClose={vi.fn()}>
        {() => <span>Rename</span>}
      </ContextMenu>,
    );
    expect(screen.queryByText("Rename")).toBeNull();
    unmount();

    renderMenu({ x: 10, y: 20 });
    expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();
  });

  it("closes on Escape, and from its content once a row is chosen", async () => {
    const onClose = renderMenu({ x: 10, y: 20 });

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("hands focus back on closing to what had it, not to the menu's first row", async () => {
    const Opener = () => {
      const [position, setPosition] = React.useState<IContextMenuPosition>();
      return (
        <>
          <button type="button" onContextMenu={() => setPosition({ x: 0, y: 0 })}>
            Row
          </button>

          <ContextMenu position={position} onClose={() => setPosition(undefined)}>
            {() => (
              <button autoFocus type="button">
                First item
              </button>
            )}
          </ContextMenu>
        </>
      );
    };
    render(<Opener />);
    const row = screen.getByRole("button", { name: "Row" });
    row.focus();

    fireEvent.contextMenu(row);
    expect(screen.getByRole("button", { name: "First item", hidden: true })).toHaveFocus();
    await userEvent.keyboard("{Escape}");

    expect(row).toHaveFocus();
  });

  it("closes as the page scrolls, being fixed where it opened", () => {
    const onClose = renderMenu({ x: 10, y: 20, element: document.body });

    fireEvent.scroll(window);

    expect(onClose).toHaveBeenCalled();
  });

  it("closes on a press outside it", async () => {
    const onClose = renderMenu({ x: 10, y: 20 });

    fireEvent.pointerDown(document.body);

    expect(onClose).toHaveBeenCalled();
  });
});

describe("contextMenuPosition", () => {
  const event = (clientX: number, clientY: number) =>
    ({
      clientX,
      clientY,
      currentTarget: { getBoundingClientRect: () => ({ left: 40, bottom: 60 }) },
    }) as unknown as MouseEvent<Element>;

  it("is the pointer, for a right-click", () => {
    expect(contextMenuPosition(event(15, 25))).toMatchObject({ x: 15, y: 25 });
  });

  it("is under the element's start, from the keyboard, which gives no pointer", () => {
    expect(contextMenuPosition(event(0, 0))).toMatchObject({ x: 40, y: 60 });
  });
});
