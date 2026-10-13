import React from "react";

import { useImageColour } from "@/ui/components/image/useImageColour.hook";

/**
 * A group row's background, in its picture's colour, which CSS fades across the row, so
 * there's no blur filter to repaint as the table scrolls. Nothing until the colour is known.
 */
interface ITableGroupWashProps {
  /** The group's picture, whose colour washes its row. */
  src: string;
}

export const TableGroupWash = ({ src }: ITableGroupWashProps) => {
  const colour = useImageColour(src);

  if (colour === undefined) {
    return null;
  }

  return (
    <span aria-hidden={true} className="nxm-table-group-wash" style={{ backgroundColor: colour }} />
  );
};
