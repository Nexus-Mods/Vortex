import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";

import { hasModifierKey } from "@/ui/utils/hasModifierKey";

interface IResizeHandleOptions {
  /** Where the handle is while it isn't dragged. */
  value: number;
  /** The least it goes to, and where Home takes it. */
  min: number;
  /** The most it goes to, and where End takes it. */
  max: number;
  /** The most a drag takes it to. Default `max`. */
  dragMax?: number;
  /** How far Left or Right moves it. */
  step: number;
  /** Rounds a value to the handle's precision, once it's kept within its bounds. */
  round: (value: number) => number;
  /** Where a pointer at `clientX` drags it, from where the drag started; unset to stay put. */
  dragTo: (clientX: number, start: { clientX: number; value: number }) => number | undefined;
  /** Takes where a key, or a drag once let go, moves it. */
  onChange: (value: number) => void;
  /** Puts it back as it comes, from a double-click or Enter. */
  onReset: () => void;
  /** Takes where a drag has it as it goes, then `undefined` once it's let go or cancelled. */
  onDrag?: (value: number | undefined) => void;
}

/**
 * A resize handle's behaviour, for a `separator`: dragged, it follows the pointer and hands
 * over where it ended once let go, or nothing if it didn't move or the drag was cancelled; the
 * arrow keys move it a step, Home and End to its bounds; Enter or a double-click reset it. Keys
 * with a modifier are left alone. Gives where to draw it, mid-drag or not, for its aria values.
 */
export const useResizeHandle = ({
  value,
  min,
  max,
  dragMax = max,
  step,
  round,
  dragTo,
  onChange,
  onReset,
  onDrag,
}: IResizeHandleOptions) => {
  const drag = useRef<{ clientX: number; value: number; to: number }>(undefined);
  const [dragValue, setDragValue] = useState<number>();

  const clamp = (next: number, upper = max) => round(Math.min(upper, Math.max(min, next)));

  const setDrag = (next: number | undefined) => {
    setDragValue(next);
    onDrag?.(next);
  };

  /** Ends a drag, handing over where it went unless it was cancelled or didn't move. */
  const endDrag = (keep: boolean) => {
    const ended = drag.current;
    if (ended === undefined) {
      return;
    }

    drag.current = undefined;
    if (keep && ended.to !== ended.value) {
      onChange(ended.to);
    }
    setDrag(undefined);
  };

  return {
    /** Where to draw the handle: where a drag has it, or its value. */
    value: dragValue ?? value,
    /** Whether it's being dragged. */
    dragging: dragValue !== undefined,
    handleProps: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture?.(event.pointerId);
        drag.current = { clientX: event.clientX, value, to: value };
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const start = drag.current;
        const to = start && dragTo(event.clientX, start);
        if (start === undefined || to === undefined) {
          return;
        }
        start.to = clamp(to, dragMax);
        setDrag(start.to);
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        endDrag(true);
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      },
      onPointerCancel: () => endDrag(false),
      onLostPointerCapture: () => endDrag(false),
      onDoubleClick: onReset,
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (hasModifierKey(event)) {
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          onReset();
          return;
        }

        const next = {
          ArrowLeft: value - step,
          ArrowRight: value + step,
          Home: min,
          End: max,
        }[event.key];

        if (next !== undefined) {
          event.preventDefault();
          onChange(clamp(next));
        }
      },
    },
  };
};
