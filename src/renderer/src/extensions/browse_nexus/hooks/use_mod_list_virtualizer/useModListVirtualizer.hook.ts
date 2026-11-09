import { defaultRangeExtractor, type Range, useVirtualizer } from "@tanstack/react-virtual";
import { type FocusEvent, type RefObject, useCallback, useLayoutEffect, useState } from "react";

/** A card's height, with the gap under it, until it's measured. */
const ESTIMATED_SIZE = 160;

interface IModListVirtualizerOptions {
  /** The list's scroller, which the cards are virtualised against. */
  scrollRef: RefObject<HTMLDivElement>;
  /** How many cards the list has, rendered or not. */
  count: number;
  /** A card's stable key, so its place survives cards added after it. */
  getItemKey: (index: number) => string;
  /** A card that stays rendered wherever it is, such as the one Tab moves focus to. */
  keptIndex: number | undefined;
}

/**
 * Virtualises the list's cards against its scroller, each measured as it renders, as a card's
 * height depends on its text and the list's width. Keeps the focused card and `keptIndex`
 * rendered however far they scroll out of view, so focus and Tab order survive. `startRef` goes
 * on the element the cards are placed in, which may be replaced, as it is while a list loads.
 */
export const useModListVirtualizer = ({
  scrollRef,
  count,
  getItemKey,
  keptIndex,
}: IModListVirtualizerOptions) => {
  const [start, setStart] = useState<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number>();

  // Where the cards start in the scroller's content, again whenever that content resizes or
  // they're placed in another element. The observer reports once on observing.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;

    if (!scroller || !start || typeof ResizeObserver === "undefined") {
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
  }, [scrollRef, start]);

  const rangeExtractor = useCallback(
    (range: Range) => {
      const kept = [focusedIndex, keptIndex].filter(
        (index) => index !== undefined && index < range.count,
      );

      return [...new Set([...defaultRangeExtractor(range), ...kept])].sort((a, b) => a - b);
    },
    [focusedIndex, keptIndex],
  );

  const virtualizer = useVirtualizer({
    count,
    estimateSize: () => ESTIMATED_SIZE,
    getItemKey,
    getScrollElement: () => scrollRef.current,
    overscan: 4,
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

  return {
    items: virtualizer.getVirtualItems().map((item) => ({
      ...item,
      start: item.start - scrollMargin,
    })),
    totalSize: virtualizer.getTotalSize(),
    measureElement: virtualizer.measureElement,
    scrollToTop: () => virtualizer.scrollToOffset(0),
    onBlur,
    onFocus,
    startRef: setStart,
  };
};
