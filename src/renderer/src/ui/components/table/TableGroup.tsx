import React, { type CSSProperties, type ReactNode } from "react";

import { useImageColour } from "@/ui/components/image/useImageColour.hook";

interface ITableGroupProps {
  /** The group's picture, whose colour tints its rows once that's known. */
  image?: string;
  /** Its heading and rows, with the spacers among them. */
  children: ReactNode;
}

/** A group's heading and rows, as tall as all of them, so the heading sticks while they pass. */
export const TableGroup = ({ image, children }: ITableGroupProps) => {
  const colour = useImageColour(image);

  return (
    <div
      className="nxm-table-group"
      role="rowgroup"
      style={colour ? ({ "--nxm-table-group-colour": colour } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
};
