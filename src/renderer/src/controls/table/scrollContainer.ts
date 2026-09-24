const SCROLLING = ["auto", "scroll", "overlay"];

/**
 * The nearest ancestor of `element` that scrolls vertically, or `null` when only the
 * window does.
 *
 * A table with a sticky header does not scroll itself: its main pane grows as tall as
 * its rows and the page scrolls it instead. Row visibility has to be measured against
 * that scrolling ancestor, because an IntersectionObserver rooted at an element that
 * doesn't clip treats its whole box as visible — so every row of the table, however
 * many thousand, counts as on screen and renders in full. `null` is the viewport, which
 * is what the observer falls back to without a root.
 */
export function scrollContainerOf(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    if (SCROLLING.includes(getComputedStyle(node).overflowY)) {
      return node;
    }
  }
  return null;
}
