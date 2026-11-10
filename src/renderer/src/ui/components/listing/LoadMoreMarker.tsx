import React, { type RefObject, useEffect, useRef } from "react";

interface ILoadMoreMarkerProps {
  /** Called when the marker comes within `distance` of view, and again each time it remounts. */
  onVisible: () => void;
  /** How far below the view, in pixels, the marker counts as in view. */
  distance: number;
  /** The element the list scrolls in, whose view it's watched against; the window's without one. */
  scrollRef?: RefObject<HTMLElement>;
}

/**
 * An empty marker at the end of a list that tells it to load more as it nears the view. Watched
 * against the list's scroller, as `distance` on the window wouldn't reach into one. A marker still
 * in view after more loads only reports again once remounted.
 */
export const LoadMoreMarker = ({ onVisible, distance, scrollRef }: ILoadMoreMarkerProps) => {
  const markerRef = useRef<HTMLDivElement>(null);
  const onVisibleRef = useRef(onVisible);

  useEffect(() => {
    onVisibleRef.current = onVisible;
  });

  useEffect(() => {
    const marker = markerRef.current;

    if (!marker || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onVisibleRef.current();
        }
      },
      { root: scrollRef?.current ?? null, rootMargin: `0px 0px ${distance}px 0px` },
    );

    observer.observe(marker);

    return () => observer.disconnect();
  }, [distance, scrollRef]);

  return <div aria-hidden className="h-px shrink-0" ref={markerRef} />;
};
