import React from "react";

import { useImageCanvas } from "./useImageCanvas.hook";

/** A sticky cell's share of its group's tint, which its solid background would hide. */
export const TableCellTint = ({ src }: { src: string }) => {
  const canvasRef = useImageCanvas(src);

  return (
    <canvas
      aria-hidden={true}
      className="nxm-table-cell-tint"
      height={1}
      ref={canvasRef}
      width={1}
    />
  );
};
