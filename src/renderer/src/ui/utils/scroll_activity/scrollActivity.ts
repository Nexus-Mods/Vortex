/** How long a scroll area counts as scrolling after its last scroll, in milliseconds. */
export const SCROLL_ACTIVITY_DELAY = 1000;

/** Whether a pointer at the event's point is on the element's own scrollbar, not its content. */
const isOnScrollbar = (element: Element, event: PointerEvent) => {
  const rect = element.getBoundingClientRect();
  const x = event.clientX - rect.left - element.clientLeft;
  const y = event.clientY - rect.top - element.clientTop;

  return (
    (element.scrollHeight > element.clientHeight && x >= element.clientWidth) ||
    (element.scrollWidth > element.clientWidth && y >= element.clientHeight)
  );
};

/**
 * Marks whichever element is scrolling with `data-scrolling`, until it has been still for
 * `delay`, so its scrollbar can show only then; and an element with `data-scrollbar-hover`
 * while the pointer is over its scrollbar or holds it, through a drag that leaves the scrollbar
 * and until the pointer is let go and moves off it, so its thumb can stay lit. Listens on `root`
 * as it captures, so it sees every scroll area under it, since scroll events don't bubble.
 * Returns the way to stop.
 */
export const watchScrollActivity = (root: Document, delay = SCROLL_ACTIVITY_DELAY) => {
  const timers = new WeakMap<Element, number>();
  let held: Element | undefined;
  let hovered: Element | undefined;
  let marked: Element | undefined;

  /** Moves the mark to the scrollbar that's held, else the one under the pointer. */
  const updateMark = () => {
    const next = held ?? hovered;

    if (next === marked) {
      return;
    }

    marked?.removeAttribute("data-scrollbar-hover");
    next?.setAttribute("data-scrollbar-hover", "");
    marked = next;
  };

  /** Notes which scrollbar, if any, the pointer is over. */
  const trackHover = (event: PointerEvent) => {
    hovered =
      event.target instanceof Element && isOnScrollbar(event.target, event)
        ? event.target
        : undefined;
  };

  const onScroll = (event: Event) => {
    const target = event.target instanceof Element ? event.target : root.scrollingElement;

    if (!target) {
      return;
    }

    target.setAttribute("data-scrolling", "");
    window.clearTimeout(timers.get(target));
    timers.set(
      target,
      window.setTimeout(() => target.removeAttribute("data-scrolling"), delay),
    );
  };

  const onPointerDown = (event: PointerEvent) => {
    trackHover(event);
    held = hovered;
    updateMark();
  };

  const onPointerUp = (event: PointerEvent) => {
    trackHover(event);
    held = undefined;
    updateMark();
  };

  /** Follows the pointer; a move with no button down also lets go, in case a drag ate the up. */
  const onPointerMove = (event: PointerEvent) => {
    trackHover(event);

    if (event.buttons === 0) {
      held = undefined;
    }

    updateMark();
  };

  const onLeave = () => {
    held = undefined;
    hovered = undefined;
    updateMark();
  };

  root.addEventListener("scroll", onScroll, { capture: true, passive: true });
  root.addEventListener("pointerdown", onPointerDown, { capture: true });
  root.addEventListener("pointerup", onPointerUp, { capture: true });
  root.addEventListener("pointercancel", onLeave, { capture: true });
  root.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });
  root.documentElement.addEventListener("pointerleave", onLeave);

  return () => {
    onLeave();
    root.removeEventListener("scroll", onScroll, { capture: true });
    root.removeEventListener("pointerdown", onPointerDown, { capture: true });
    root.removeEventListener("pointerup", onPointerUp, { capture: true });
    root.removeEventListener("pointercancel", onLeave, { capture: true });
    root.removeEventListener("pointermove", onPointerMove, { capture: true });
    root.documentElement.removeEventListener("pointerleave", onLeave);
  };
};
