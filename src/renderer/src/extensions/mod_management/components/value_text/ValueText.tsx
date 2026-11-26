import React from "react";

/** A value in the Version column's grey, so none stands out beside it; brighter while sorted by. */
export const ValueText = ({ children }: { children: string }) => (
  <span className="truncate text-translucent-subdued in-data-sorted:text-neutral-moderate">
    {children}
  </span>
);
