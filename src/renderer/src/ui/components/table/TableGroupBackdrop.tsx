import React, { type CSSProperties } from "react";

import { useImageCanvas } from "./useImageCanvas.hook";

interface ITableGroupBackdropProps {
  /** The group's picture, whose colour tints its rows. */
  src: string;
  /** Where the group's rows start, from the top of the table's first row. */
  top: number;
  /** The height of the group's rows. */
  height: number;
}

/**
 * The tint behind a group's rows, in its picture's colour. Positioned from the rows'
 * heights rather than wrapping them: the rows are the grid's own, and may not all render.
 */
export const TableGroupBackdrop = ({ src, top, height }: ITableGroupBackdropProps) => {
  const canvasRef = useImageCanvas(src);

  return (
    <canvas
      aria-hidden={true}
      className="nxm-table-group-backdrop"
      height={1}
      ref={canvasRef}
      style={{ "--nxm-table-backdrop-top": `${top}px`, height: `${height}px` } as CSSProperties}
      width={1}
    />
  );
};
