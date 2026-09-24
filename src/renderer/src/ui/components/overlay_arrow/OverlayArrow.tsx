import React, { useId } from "react";

/** Shared with the tooltip's `FloatingArrow`, so the two shapes can't drift apart. */
export const OVERLAY_ARROW_WIDTH = 12;
export const OVERLAY_ARROW_HEIGHT = 8;
/** Floating UI doubles this, so 1 renders as a 1px edge. */
export const OVERLAY_ARROW_STROKE_WIDTH = 1;

export type OverlayArrowSide = "bottom" | "left" | "right" | "top";

const SIDES: Record<OverlayArrowSide, { rotation: string; inset: string }> = {
  bottom: { rotation: "rotate(180deg)", inset: "100%" },
  left: { rotation: "rotate(-90deg)", inset: `calc(100% - ${OVERLAY_ARROW_STROKE_WIDTH}px)` },
  right: { rotation: "rotate(90deg)", inset: `calc(100% - ${OVERLAY_ARROW_STROKE_WIDTH}px)` },
  top: { rotation: "", inset: "100%" },
};

const arrowPath = (width: number, height: number): string =>
  `M0,0 H${width} L${width / 2},${height} Q${width / 2},${height} ${width / 2},${height} Z`;

interface IOverlayArrowProps {
  side: OverlayArrowSide;
  tipFromEnd: number;
}

/**
 * The tooltip's arrow, for a panel that isn't a tooltip. Headless UI positions its own
 * panels, so `FloatingArrow` — which needs a floating context — can't draw their beak.
 */
export const OverlayArrow = ({ side, tipFromEnd }: IOverlayArrowProps) => {
  const clipPathId = useId();
  const { inset, rotation } = SIDES[side];
  const strokeWidth = OVERLAY_ARROW_STROKE_WIDTH * 2;
  const d = arrowPath(OVERLAY_ARROW_WIDTH, OVERLAY_ARROW_HEIGHT);
  const box = OVERLAY_ARROW_WIDTH + strokeWidth;
  const crossEdge = side === "left" || side === "right" ? "bottom" : "right";

  return (
    <svg
      aria-hidden
      className="nxm-overlay-arrow"
      height={OVERLAY_ARROW_WIDTH}
      style={{
        [crossEdge]: tipFromEnd - box / 2,
        [side]: inset,
        position: "absolute",
        transform: rotation,
      }}
      viewBox={`0 0 ${OVERLAY_ARROW_WIDTH} ${OVERLAY_ARROW_WIDTH}`}
      width={box}
    >
      <path clipPath={`url(#${clipPathId})`} d={d} fill="none" strokeWidth={strokeWidth + 1} />

      <path d={d} />

      <clipPath id={clipPathId}>
        <rect
          height={OVERLAY_ARROW_WIDTH}
          width={box}
          x={-OVERLAY_ARROW_STROKE_WIDTH}
          y={OVERLAY_ARROW_STROKE_WIDTH}
        />
      </clipPath>
    </svg>
  );
};
