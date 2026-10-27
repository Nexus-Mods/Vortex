import React from "react";

/** A `ModCard` while its mod loads: its picture, tag, name, summary and footer, pulsing. */
export const ModCardSkeleton = () => (
  <div className="flex animate-pulse items-center gap-x-4 rounded-sm py-2 pr-4 pl-2">
    <div className="aspect-video h-30 shrink-0 rounded-sm bg-surface-translucent-mid" />

    <div className="flex min-w-0 flex-1 flex-col justify-between gap-y-3 self-stretch py-0.5">
      <div className="flex flex-col gap-y-2">
        <div className="h-5 w-20 rounded-sm bg-surface-translucent-mid" />

        <div className="h-5 w-3/4 rounded-sm bg-surface-translucent-mid" />

        <div className="h-3 w-full rounded-sm bg-surface-translucent-mid" />
      </div>

      <div className="flex items-center justify-between gap-x-3">
        <div className="h-3 w-24 rounded-sm bg-surface-translucent-mid" />

        <div className="h-3 w-32 rounded-sm bg-surface-translucent-mid" />
      </div>
    </div>
  </div>
);
