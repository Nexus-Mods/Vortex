import React from "react";

import { useImageColour } from "@/ui/components/image/useImageColour.hook";

/**
 * A group row's background, in its picture's colour, which CSS fades across the row, so
 * there's no blur filter to repaint as the table scrolls. Nothing until the colour is known.
 */
export const TableGroupWash = ({ src }: { src: string }) => {
  const colour = useImageColour(src);

  if (colour === undefined) {
    return null;
  }

  return (
    <span aria-hidden={true} className="nxm-table-group-wash" style={{ backgroundColor: colour }} />
  );
};
