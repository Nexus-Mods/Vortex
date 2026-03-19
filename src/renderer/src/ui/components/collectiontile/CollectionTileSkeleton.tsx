import React from "react";

export const CollectionTileSkeleton = () => (
  <div className="animate-pulse rounded-md bg-surface-translucent-mid">
    <div className="flex items-center gap-x-3.5 p-3">
      <div className="aspect-4/5 w-full max-w-35 shrink-0 rounded-xs bg-surface-translucent-mid" />

      <div className="grow space-y-4">
        <div className="space-y-2">
          <div className="h-6 w-3/4 rounded-sm bg-surface-translucent-mid" />

          <div className="flex items-center gap-x-2">
            <div className="size-4 rounded-full bg-surface-translucent-mid" />

            <div className="h-3 w-26 rounded-sm bg-surface-translucent-mid" />
          </div>
        </div>

        <div className="h-3 w-22 rounded-sm bg-surface-translucent-mid" />

        <div className="flex items-center gap-x-5">
          <div className="h-3 w-10 rounded-sm bg-surface-translucent-mid" />

          <div className="h-3 w-20 rounded-sm bg-surface-translucent-mid" />

          <div className="h-3 w-10 rounded-sm bg-surface-translucent-mid" />
        </div>

        <div className="space-y-1">
          <div className="h-3 w-full rounded-sm bg-surface-translucent-mid" />

          <div className="h-3 w-full rounded-sm bg-surface-translucent-mid" />

          <div className="h-3 w-2/3 rounded-sm bg-surface-translucent-mid" />
        </div>
      </div>
    </div>

    <div className="flex shrink-0 items-center gap-x-2 rounded-b bg-surface-translucent-mid px-3 py-2">
      <div className="h-6 w-24 rounded-sm bg-surface-translucent-mid" />

      <div className="h-6 w-24 rounded-sm bg-surface-translucent-mid" />
    </div>
  </div>
);
