/**
 * Tests for finding the element a sticky-header table's rows scroll in: the nearest
 * ancestor that actually scrolls, skipping the ones whose overflow is visible, as the
 * table's own main pane is once its header sticks to the page.
 */
import { afterEach, describe, expect, it } from "vitest";

import { scrollContainerOf } from "./scrollContainer";

function tree(...overflows: string[]): HTMLElement[] {
  const nodes = overflows.map((overflowY) => {
    const node = document.createElement("div");
    node.style.overflowY = overflowY;
    return node;
  });
  nodes.reduce((parent, child) => parent.appendChild(child));
  document.body.appendChild(nodes[0]);
  return nodes;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("scrollContainerOf", () => {
  it("skips a pane whose overflow is visible for the page that scrolls it", () => {
    const [page, , pane] = tree("auto", "visible", "visible");
    expect(scrollContainerOf(pane)).toBe(page);
  });

  it("takes the nearest scrolling ancestor", () => {
    const [, inner, pane] = tree("auto", "scroll", "visible");
    expect(scrollContainerOf(pane)).toBe(inner);
  });

  it("does not return the element itself, even when it scrolls", () => {
    const [page, pane] = tree("auto", "auto");
    expect(scrollContainerOf(pane)).toBe(page);
  });

  it("falls back to the viewport when nothing above scrolls", () => {
    const [, pane] = tree("visible", "visible");
    expect(scrollContainerOf(pane)).toBeNull();
  });

  it("ignores a clipped ancestor that cannot be scrolled", () => {
    const [page, , pane] = tree("auto", "hidden", "visible");
    expect(scrollContainerOf(pane)).toBe(page);
  });
});
