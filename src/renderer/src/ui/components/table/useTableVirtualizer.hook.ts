import {
  defaultRangeExtractor,
  type Range,
  useVirtualizer,
  type Virtualizer,
} from "@tanstack/react-virtual";
import { type FocusEvent, useCallback, useLayoutEffect, useRef, useState } from "react";

const SCROLLING = /auto|scroll|overlay/;

const findScrollParent = (element: HTMLElement): HTMLElement | null => {
  for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
    if (SCROLLING.test(getComputedStyle(parent).overflowY)) {
      return parent;
    }
  }
  return null;
};

interface IPlacedRow {
  /** Its place among the table's rows. */
  index: number;
  /** Where the row starts, from the top of the first. */
  start: number;
  /** Its height, as the table gave it. */
  size: number;
}

export interface ITableVirtualRow {
  /** Its place among the table's rows, to render it from. */
  index: number;
  /** The height of the rows out of view just before it. */
  gap: number;
}

// Each row's gap is the space between it and the row rendered before it.
const withGaps = (rows: IPlacedRow[]): ITableVirtualRow[] =>
  rows.map(({ index, start }, position) => {
    const previous = rows[position - 1];
    return { index, gap: start - (previous === undefined ? 0 : previous.start + previous.size) };
  });

const virtualRows = (
  virtualizer: Virtualizer<HTMLElement, Element>,
  scrollMargin: number,
): IPlacedRow[] =>
  virtualizer.getVirtualItems().map(({ index, size, start }) => ({
    index,
    size,
    start: start - scrollMargin,
  }));

// Every row, in place, when there's nothing to virtualise against.
const allRows = (count: number, getItemSize: (index: number) => number): IPlacedRow[] => {
  let start = 0;

  return Array.from({ length: count }, (_, index) => {
    const row = { index, size: getItemSize(index), start };
    start += row.size;

    return row;
  });
};

interface ITableVirtualizerOptions {
  /** How many rows the table has, rendered or not. */
  count: number;
  /** A row's stable key, so its place survives rows added or removed above it. */
  getItemKey: (index: number) => string;
  /** A row's height, which the virtualiser takes as exact rather than measuring. */
  getItemSize: (index: number) => number;
}

/**
 * Virtualises the table's rows against the page's scroller, its nearest scrolling ancestor,
 * so the page scrolls rather than the table. Keeps the focused row rendered however far it
 * scrolls out of view, so focus and Tab order survive. With no scroller, every row renders.
 */
export const useTableVirtualizer = ({
  count,
  getItemKey,
  getItemSize,
}: ITableVirtualizerOptions) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLDivElement>(null);

  // Undefined until looked for, so the first render doesn't draw every row.
  const [scroller, setScroller] = useState<HTMLElement | null>();
  const [scrollMargin, setScrollMargin] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number>();

  useLayoutEffect(() => {
    if (tableRef.current !== null) {
      setScroller(findScrollParent(tableRef.current));
    }
  }, []);

  // Where the rows start in the scroller's content, again whenever that content resizes,
  // which is how anything above them moves them. The observer reports once on observing.
  useLayoutEffect(() => {
    const start = startRef.current;

    if (!scroller || start === null || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(() =>
      setScrollMargin(
        start.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop,
      ),
    );

    Array.from(scroller.children).forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, [scroller]);

  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);

      if (
        focusedIndex === undefined ||
        focusedIndex >= range.count ||
        indexes.includes(focusedIndex)
      ) {
        return indexes;
      }

      return [...indexes, focusedIndex].sort((a, b) => a - b);
    },
    [focusedIndex],
  );

  const virtualizer = useVirtualizer({
    count,
    enabled: !!scroller,
    estimateSize: getItemSize,
    getItemKey,
    getScrollElement: () => scroller ?? null,
    overscan: 10,
    rangeExtractor,
    scrollMargin,
  });

  const onFocus = (event: FocusEvent<HTMLElement>) => {
    const index = event.target.closest<HTMLElement>("[data-index]")?.dataset.index;
    setFocusedIndex(index === undefined ? undefined : Number(index));
  };

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocusedIndex(undefined);
    }
  };

  const placeRows = (): IPlacedRow[] => {
    // Not looked for yet.
    if (scroller === undefined) {
      return [];
    }

    // Nothing to virtualise against.
    if (scroller === null) {
      return allRows(count, getItemSize);
    }

    return virtualRows(virtualizer, scrollMargin);
  };

  const placed = placeRows();

  const last = placed.at(-1);
  const renderedEnd = last === undefined ? 0 : last.start + last.size;

  return {
    items: withGaps(placed),
    endGap: scroller ? virtualizer.getTotalSize() - renderedEnd : 0,
    onBlur,
    onFocus,
    startRef,
    tableRef,
  };
};
