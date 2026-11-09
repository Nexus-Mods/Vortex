import React from "react";

/** A `ModCard` while its mod loads: its picture, name, summary and footer, pulsing. */
export const ModCardSkeleton = () => (
  <div className="flex animate-pulse flex-col gap-y-3 rounded-sm p-2 @md:flex-row @md:items-start @md:gap-x-4 @md:pr-4">
    <div className="aspect-video w-full shrink-0 rounded-sm bg-surface-translucent-mid @md:w-2/5 @md:max-w-60.5" />

    <div className="flex min-w-0 flex-1 flex-col gap-y-3 self-stretch pt-0.5">
      <div className="flex flex-col gap-y-1">
        <div className="h-5 w-3/4 rounded-sm bg-surface-translucent-mid" />

        <div className="flex flex-col gap-y-1.5">
          <div className="h-3 w-full rounded-sm bg-surface-translucent-mid" />

          <div className="h-3 w-full rounded-sm bg-surface-translucent-mid" />

          <div className="h-3 w-2/3 rounded-sm bg-surface-translucent-mid" />
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-x-3">
        <div className="h-3 w-24 rounded-sm bg-surface-translucent-mid" />

        <div className="h-3 w-40 rounded-sm bg-surface-translucent-mid" />
      </div>
    </div>
  </div>
);
