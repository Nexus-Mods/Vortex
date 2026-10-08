import React from "react";

import { useImageCanvas } from "./useImageCanvas.hook";

/**
 * A group row's background, in its picture's colour: one pixel, which CSS stretches over
 * the row and fades across it, so there's no blur filter to repaint as the table scrolls.
 */
export const TableGroupWash = ({ src }: { src: string }) => {
  const canvasRef = useImageCanvas(src);

  return (
    <canvas
      aria-hidden={true}
      className="nxm-table-group-wash"
      height={1}
      ref={canvasRef}
      width={1}
    />
  );
};
