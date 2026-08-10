import { describe, expect, it } from "vitest";

import { clampRange, keepIndicesInRange, rangePadding, visibleRange } from "./ListWindow";

describe("visibleRange", () => {
  it("covers the viewport plus overscan at the top", () => {
    // viewport 500 / pitch 46 ~= 11 visible rows, + 10 overscan each side
    expect(visibleRange(0, 500, 46, 10)).toEqual({ start: 0, end: 21 });
  });

  it("follows the scroll offset", () => {
    // scrolled 100 rows down (100 * 46)
    expect(visibleRange(4600, 500, 46, 10)).toEqual({ start: 90, end: 121 });
  });

  it("never returns a negative start", () => {
    expect(visibleRange(46, 500, 46, 10).start).toBe(0);
  });

  it("scales with the row pitch", () => {
    // scrolled 100 rows down at pitch 60
    expect(visibleRange(6000, 500, 60, 10).start).toBe(90);
  });
});

describe("clampRange", () => {
  it("leaves a range within bounds untouched", () => {
    expect(clampRange({ start: 0, end: 21 }, 1000)).toEqual({ start: 0, end: 21 });
  });

  it("clamps a range past the end of a short list", () => {
    expect(clampRange({ start: 90, end: 121 }, 5)).toEqual({ start: 4, end: 4 });
  });

  it("handles an empty list", () => {
    expect(clampRange({ start: 5, end: 10 }, 0)).toEqual({ start: 0, end: 0 });
  });
});

describe("rangePadding", () => {
  it("pads for the rows above and below the window", () => {
    expect(rangePadding({ start: 90, end: 121 }, 1000, 46)).toEqual({
      paddingTop: 90 * 46,
      paddingBottom: (1000 - 1 - 121) * 46,
    });
  });

  it("never returns negative bottom padding", () => {
    expect(rangePadding({ start: 0, end: 999 }, 1000, 46).paddingBottom).toBe(0);
  });
});

describe("keepIndicesInRange", () => {
  it("expands the window to include a dragged row far below it", () => {
    // a row dragged out of view must stay rendered so its drag source survives
    expect(keepIndicesInRange({ start: 0, end: 30 }, [500])).toEqual({ start: 0, end: 500 });
  });

  it("expands the window to include a dragged row far above it", () => {
    expect(keepIndicesInRange({ start: 400, end: 430 }, [5])).toEqual({ start: 5, end: 430 });
  });

  it("leaves the window unchanged when no rows are dragged", () => {
    expect(keepIndicesInRange({ start: 0, end: 30 }, [])).toEqual({ start: 0, end: 30 });
  });

  it("leaves the window unchanged for a dragged row already inside it", () => {
    expect(keepIndicesInRange({ start: 0, end: 30 }, [10])).toEqual({ start: 0, end: 30 });
  });

  it("ignores not-found indices", () => {
    expect(keepIndicesInRange({ start: 10, end: 30 }, [-1])).toEqual({ start: 10, end: 30 });
  });
});
