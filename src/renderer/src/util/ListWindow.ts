// rows rendered beyond each edge of the visible range
const DEFAULT_OVERSCAN = 10;
// row pitch (row height + list gap) assumed until measured from the DOM
const DEFAULT_PITCH = 46;

export interface IListWindowOptions {
  // invoked when the visible range changes and the consumer needs to re-render
  onChange: () => void;
  overscan?: number;
  defaultPitch?: number;
}

export interface IWindowRange {
  start: number;
  end: number;
}

/**
 * Tracks which contiguous slice of a uniform-height list is scrolled into
 * view, so a long list can render only the rows on screen. Follows the
 * nearest scrollable ancestor and measures the row pitch from the DOM.
 *
 * The consumer wires it up by:
 *  - passing the content element (whose first element child holds the rows)
 *    to `setContent`, then calling `attach` once mounted;
 *  - calling `measurePitch` and `update` from componentDidUpdate;
 *  - reading `range`/`padding` during render;
 *  - calling `detach` on unmount.
 */
export class ListWindow {
  readonly #overscan: number;
  readonly #onChange: () => void;
  #pitch: number;
  #content: HTMLElement | null = null;
  #scrollParent: HTMLElement | null = null;
  #resizeObserver: ResizeObserver | null = null;
  // items reference the pitch was last measured for; measuring reads layout,
  //  which forces a reflow, so it must not run on every re-render
  #measuredFor: unknown = null;
  #start = 0;
  #end: number;

  constructor(options: IListWindowOptions) {
    this.#overscan = options.overscan ?? DEFAULT_OVERSCAN;
    this.#pitch = options.defaultPitch ?? DEFAULT_PITCH;
    this.#onChange = options.onChange;
    // until the scroll parent is known, assume two viewport-heights of rows
    this.#end = Math.ceil((2 * window.innerHeight) / this.#pitch);
  }

  // The scrollable content wrapper; its first element child holds the rows.
  public setContent = (ref: HTMLElement | null): void => {
    this.#content = ref;
  };

  // Start following the nearest scrollable ancestor. Idempotent.
  public attach(): void {
    if (this.#scrollParent !== null || this.#content === null) {
      return;
    }
    let el = this.#content.parentElement;
    while (el !== null && !["auto", "scroll"].includes(getComputedStyle(el).overflowY)) {
      el = el.parentElement;
    }
    if (el === null) {
      return;
    }
    this.#scrollParent = el;
    el.addEventListener("scroll", this.update, { passive: true });
    this.#resizeObserver = new ResizeObserver(this.update);
    this.#resizeObserver.observe(el);
    this.update();
  }

  public detach(): void {
    this.#scrollParent?.removeEventListener("scroll", this.update);
    this.#resizeObserver?.disconnect();
    this.#scrollParent = null;
    this.#resizeObserver = null;
  }

  // Measure the row pitch from the first two rendered rows, once per list
  //  change. A differing pitch re-derives the visible range.
  public measurePitch(itemsIdentity: unknown): void {
    if (this.#measuredFor === itemsIdentity || this.#content === null) {
      return;
    }
    const rows = this.#content.firstElementChild?.children;
    if (rows === undefined || rows.length < 2) {
      return;
    }
    this.#measuredFor = itemsIdentity;
    const pitch = rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top;
    if (pitch > 10 && Math.abs(pitch - this.#pitch) > 0.5) {
      this.#pitch = pitch;
      this.update();
    }
  }

  // Recompute the visible range from the current scroll position, notifying
  //  the consumer when it changes.
  public update = (): void => {
    if (this.#content === null || this.#scrollParent === null) {
      return;
    }
    const contentTop = this.#content.getBoundingClientRect().top;
    const parentRect = this.#scrollParent.getBoundingClientRect();
    const visStart = parentRect.top - contentTop;
    const start = Math.max(0, Math.floor(visStart / this.#pitch) - this.#overscan);
    const end =
      Math.ceil((visStart + this.#scrollParent.clientHeight) / this.#pitch) + this.#overscan;
    if (start !== this.#start || end !== this.#end) {
      this.#start = start;
      this.#end = end;
      this.#onChange();
    }
  };

  // The clamped [start, end] slice of `itemCount` rows to render.
  public range(itemCount: number): IWindowRange {
    const maxIdx = Math.max(0, itemCount - 1);
    const start = Math.min(Math.max(0, this.#start), maxIdx);
    const end = Math.min(Math.max(start, this.#end), maxIdx);
    return { start, end };
  }

  // Spacer padding standing in for the rows outside [start, end].
  public padding(
    start: number,
    end: number,
    itemCount: number,
  ): { paddingTop: number; paddingBottom: number } {
    return {
      paddingTop: start * this.#pitch,
      paddingBottom: Math.max(0, itemCount - 1 - end) * this.#pitch,
    };
  }
}
