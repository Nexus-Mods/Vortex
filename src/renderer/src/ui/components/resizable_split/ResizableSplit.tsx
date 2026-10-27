import React, {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useRef,
  useState,
} from "react";

import { hasModifierKey } from "@/ui/utils/hasModifierKey";
import { joinClasses } from "@/ui/utils/joinClasses";

/** How far Left or Right moves the split. */
const STEP = 0.05;

/** The split a double-click or Enter puts back. */
const EVEN = 0.5;

interface IResizableSplitProps {
  /** The pane on the left. */
  start: ReactNode;
  /** The pane on the right. */
  end: ReactNode;
  /** The left pane's share of the width, from 0 to 1. */
  split: number;
  /** Told a new split, whenever the handle moves it. */
  onSplitChange: (split: number) => void;
  /** Names the handle for screen readers. */
  label: string;
  /** Says where the handle is for screen readers, from the left pane's share as a percentage. */
  valueText?: (percent: number) => string;
  /** The smallest share the left pane takes. Default 0.3. */
  min?: number;
  /** The largest share the left pane takes. Default 0.7. */
  max?: number;
  /** Classes for the box holding both panes. */
  className?: string;
}

/**
 * Two panes side by side, with a handle over the seam that resizes them: dragged, or, once it
 * has focus, moved in steps with Left and Right and to either bound with Home and End. A
 * double-click or Enter puts it back even. The handle comes between the panes in the Tab order,
 * and draws an inset rule, brighter while it's hovered or dragged, that turns into the focus ring
 * while it has keyboard focus. The split is the caller's to keep, so it can outlive the component. Its
 * styles are the `nxm-resizable-split` classes, laid out from the `--nxm-resizable-split` it
 * sets, so a page can restyle it.
 */
export const ResizableSplit = ({
  start,
  end,
  split,
  onSplitChange,
  label,
  valueText,
  min = 0.3,
  max = 0.7,
  className,
}: IResizableSplitProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  /** Keeps a split between the bounds, to the hundredth. */
  const clamp = (value: number) => Math.round(Math.min(max, Math.max(min, value)) * 100) / 100;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();

    if (!isDraggingRef.current || !rect?.width) {
      return;
    }

    onSplitChange(clamp((event.clientX - rect.left) / rect.width));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = {
      ArrowLeft: split - STEP,
      ArrowRight: split + STEP,
      Home: min,
      End: max,
      Enter: EVEN,
    }[event.key];

    if (next === undefined || hasModifierKey(event)) {
      return;
    }

    event.preventDefault();
    onSplitChange(clamp(next));
  };

  return (
    <div
      className={joinClasses(["nxm-resizable-split", className])}
      ref={containerRef}
      style={{ "--nxm-resizable-split": split } as CSSProperties}
    >
      {start}

      <div
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemax={Math.round(max * 100)}
        aria-valuemin={Math.round(min * 100)}
        aria-valuenow={Math.round(split * 100)}
        aria-valuetext={valueText?.(Math.round(split * 100))}
        className="nxm-resizable-split-handle"
        data-dragging={isDragging || undefined}
        role="separator"
        tabIndex={0}
        onDoubleClick={() => onSplitChange(EVEN)}
        onKeyDown={onKeyDown}
        onPointerCancel={onPointerUp}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="nxm-resizable-split-rule" />
      </div>

      {end}
    </div>
  );
};
