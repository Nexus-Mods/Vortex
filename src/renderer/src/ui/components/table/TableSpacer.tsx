import React from "react";

/** Stands in for rows out of view, at their height, so the scroller keeps its full length. */
export const TableSpacer = ({ height }: { height: number }) => {
  if (height) {
    return (
      <div className="nxm-table-spacer" role="presentation" style={{ height: `${height}px` }} />
    );
  }

  return null;
};
