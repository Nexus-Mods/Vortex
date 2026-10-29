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
  /** Told a new split when the handle moves it: once a drag lets go, or on each key. */
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
 * Two panes side by side with a handle between them that resizes them, by dragging or with the
 * arrow keys, Home and End. Double-click or Enter evens it out. The caller keeps the split; a
 * drag hands it over once let go. Styled by the `nxm-resizable-split` classes.
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
  const dragSplitRef = useRef<number>(undefined);
  const [dragSplit, setDragSplit] = useState<number>();
  const visibleSplit = dragSplit ?? split;

  /** Keeps a split between the bounds, to the hundredth. */
  const clamp = (value: number) => Math.round(Math.min(max, Math.max(min, value)) * 100) / 100;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragSplitRef.current = split;
    setDragSplit(split);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();

    if (dragSplitRef.current === undefined || !rect?.width) {
      return;
    }

    dragSplitRef.current = clamp((event.clientX - rect.left) / rect.width);
    setDragSplit(dragSplitRef.current);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    const finalSplit = dragSplitRef.current;
    dragSplitRef.current = undefined;
    setDragSplit(undefined);

    if (finalSplit !== undefined && finalSplit !== split) {
      onSplitChange(finalSplit);
    }
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
      style={{ "--nxm-resizable-split": visibleSplit } as CSSProperties}
    >
      {start}

      <div
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemax={Math.round(max * 100)}
        aria-valuemin={Math.round(min * 100)}
        aria-valuenow={Math.round(visibleSplit * 100)}
        aria-valuetext={valueText?.(Math.round(visibleSplit * 100))}
        className="nxm-resizable-split-handle"
        data-dragging={dragSplit !== undefined || undefined}
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
