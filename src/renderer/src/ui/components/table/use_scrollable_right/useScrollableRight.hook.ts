import { type RefObject, useLayoutEffect } from "react";

/** Set while the scroller has further to go right. */
export const SCROLLABLE_RIGHT = "data-scrollable-right";

/**
 * Marks the table while its scroller can scroll right, on the element and only on change, so
 * reaching an edge restyles only what the attribute's rules pick out and nothing re-renders.
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

    const update = () => {
      const scrollable = scroller.scrollLeft < scroller.scrollWidth - scroller.clientWidth - 1;
      if (table.hasAttribute(SCROLLABLE_RIGHT) !== scrollable) {
        table.toggleAttribute(SCROLLABLE_RIGHT, scrollable);
      }
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });

    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
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
