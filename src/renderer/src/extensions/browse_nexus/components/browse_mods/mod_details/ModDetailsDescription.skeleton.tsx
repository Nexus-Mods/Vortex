import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/** Its lines, as wide as each is. */
const LINES = ["w-full", "w-full", "w-full", "w-2/3"];

/** A mod's description in `ModDetails` while it loads: a few lines of text, pulsing. */
export const ModDetailsDescriptionSkeleton = () => (
  <div className="flex animate-pulse flex-col gap-y-1.5">
    {LINES.map((width, index) => (
      <div
        className={joinClasses(["h-3 rounded-sm bg-surface-translucent-mid", width])}
        key={index}
      />
    ))}
  </div>
);
