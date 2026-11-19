import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SCROLLABLE_RIGHT, useScrollableRight } from "./useScrollableRight.hook";

/** A scroller of the given widths, scrolled to `scrollLeft`, with the table in it. */
const setup = (scrollWidth: number, clientWidth: number, scrollLeft = 0) => {
  const scroller = document.createElement("div");
  const table = document.createElement("div");
  scroller.append(table);
  Object.defineProperty(scroller, "scrollWidth", { value: scrollWidth, configurable: true });
  Object.defineProperty(scroller, "clientWidth", { value: clientWidth, configurable: true });
  scroller.scrollLeft = scrollLeft;
  return { scroller, table, tableRef: { current: table } };
};

describe("useScrollableRight", () => {
  it("marks the table while its scroller has further to go right", () => {
    const { scroller, table, tableRef } = setup(1400, 1000);

    renderHook(() => useScrollableRight(scroller, tableRef));

    expect(table).toHaveAttribute(SCROLLABLE_RIGHT);
  });

  it("leaves it unmarked when everything fits", () => {
    const { scroller, table, tableRef } = setup(1000, 1000);

    renderHook(() => useScrollableRight(scroller, tableRef));

    expect(table).not.toHaveAttribute(SCROLLABLE_RIGHT);
  });

  it("clears the mark once scrolled to the end, and puts it back on scrolling away", () => {
    const { scroller, table, tableRef } = setup(1400, 1000);
    renderHook(() => useScrollableRight(scroller, tableRef));

    scroller.scrollLeft = 400;
    scroller.dispatchEvent(new Event("scroll"));
    expect(table).not.toHaveAttribute(SCROLLABLE_RIGHT);

    scroller.scrollLeft = 100;
    scroller.dispatchEvent(new Event("scroll"));
    expect(table).toHaveAttribute(SCROLLABLE_RIGHT);
  });

  it("stops listening once it's gone", () => {
    const { scroller, table, tableRef } = setup(1400, 1000);
    const { unmount } = renderHook(() => useScrollableRight(scroller, tableRef));

    unmount();
    scroller.scrollLeft = 400;
    scroller.dispatchEvent(new Event("scroll"));

    expect(table).toHaveAttribute(SCROLLABLE_RIGHT);
  });
});
