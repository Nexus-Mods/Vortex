import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { watchScrollActivity } from "./scrollActivity";

describe("watchScrollActivity", () => {
  let stop: () => void;
  let area: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    area = document.createElement("div");
    document.body.append(area);
    stop = watchScrollActivity(document, 1000);
  });

  afterEach(() => {
    stop();
    area.remove();
    vi.useRealTimers();
  });

  it("marks a scroll area while it scrolls, and clears it once it's been still", () => {
    area.dispatchEvent(new Event("scroll"));
    expect(area).toHaveAttribute("data-scrolling");

    vi.advanceTimersByTime(1000);
    expect(area).not.toHaveAttribute("data-scrolling");
  });

  it("keeps the mark while scrolling goes on", () => {
    area.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(800);
    area.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(800);

    expect(area).toHaveAttribute("data-scrolling");
  });

  it("marks only the area that scrolled", () => {
    const other = document.createElement("div");
    document.body.append(other);

    area.dispatchEvent(new Event("scroll"));

    expect(other).not.toHaveAttribute("data-scrolling");
    other.remove();
  });

  /** Gives the area a layout: 100px of content beside its scrollbar, scrolling 500px in 200px. */
  const layOut = () => {
    for (const [key, value] of Object.entries({
      clientWidth: 100,
      clientHeight: 200,
      scrollWidth: 100,
      scrollHeight: 500,
      clientLeft: 0,
      clientTop: 0,
    })) {
      Object.defineProperty(area, key, { configurable: true, value });
    }
    area.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
  };

  const pointer = (type: string, clientX: number, buttons = 0) =>
    area.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY: 50, buttons }));
  const isMarked = () => area.hasAttribute("data-scrollbar-hover");

  it("marks an area while the pointer is over its scrollbar, and not over its content", () => {
    layOut();

    pointer("pointermove", 105);
    expect(isMarked()).toBe(true);

    pointer("pointermove", 50);
    expect(isMarked()).toBe(false);
  });

  it("keeps the mark through a drag that leaves the scrollbar", () => {
    layOut();

    pointer("pointerdown", 105, 1);
    pointer("pointermove", 50, 1);
    expect(isMarked()).toBe(true);

    pointer("pointerup", 50);
    expect(isMarked()).toBe(false);
  });

  it("keeps the mark when a drag is let go over the scrollbar", () => {
    layOut();

    pointer("pointerdown", 105, 1);
    pointer("pointerup", 105);
    expect(isMarked()).toBe(true);
  });

  it("lets go on a move with no button down, if the pointer's release never arrived", () => {
    layOut();

    pointer("pointerdown", 105, 1);
    pointer("pointermove", 50, 1);
    pointer("pointermove", 50);
    expect(isMarked()).toBe(false);
  });

  it("stops marking once stopped", () => {
    stop();
    area.dispatchEvent(new Event("scroll"));
    expect(area).not.toHaveAttribute("data-scrolling");
  });
});
