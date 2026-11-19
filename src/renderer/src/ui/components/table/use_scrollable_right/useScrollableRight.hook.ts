import { type RefObject, useLayoutEffect } from "react";

/** Set while the scroller has further to go right. */
export const SCROLLABLE_RIGHT = "data-scrollable-right";

/**
 * Marks the table while its scroller can scroll right, on the element and only on change, so
 * reaching an edge restyles only what the attribute's rules pick out and nothing re-renders.
 * Widths are measured only on resize; a scroll reads only how far left it is.
 */
export const useScrollableRight = (
  scroller: HTMLElement | null | undefined,
  tableRef: RefObject<HTMLElement | null>,
) => {
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!scroller || !table) {
      return;
    }

    let maxLeft = 0;
    let lastLeft: number | undefined;

    const update = () => {
      const left = scroller.scrollLeft;
      if (left === lastLeft) {
        return;
      }
      lastLeft = left;
      const scrollable = left < maxLeft;
      if (table.hasAttribute(SCROLLABLE_RIGHT) !== scrollable) {
        table.toggleAttribute(SCROLLABLE_RIGHT, scrollable);
      }
    };

    const measure = () => {
      maxLeft = scroller.scrollWidth - scroller.clientWidth - 1;
      lastLeft = undefined;
      update();
    };

    measure();
    scroller.addEventListener("scroll", update, { passive: true });

    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(scroller);
    const header = table.querySelector(".nxm-table-header");
    if (header) {
      observer?.observe(header);
    }

    return () => {
      scroller.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [scroller, tableRef]);
};
