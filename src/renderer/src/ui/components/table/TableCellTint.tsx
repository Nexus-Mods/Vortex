import React from "react";

import { useImageColour } from "@/ui/components/image/useImageColour.hook";

/** A sticky cell's share of its group's tint, which its solid background would hide. */
interface ITableCellTintProps {
  /** The group's picture, whose colour tints the cell. */
  src: string;
}

export const TableCellTint = ({ src }: ITableCellTintProps) => {
  const colour = useImageColour(src);

  if (colour === undefined) {
    return null;
  }

  return (
    <span aria-hidden={true} className="nxm-table-cell-tint" style={{ backgroundColor: colour }} />
  );
};
