import React from "react";

import { ModDetailsDescriptionSkeleton } from "./ModDetailsDescription.skeleton";

/** The skeleton's stats, one block each, as many as `ModDetails` shows. */
const STATS = 6;

/** The skeleton's thumbnails, as many as the gallery's strip always holds. */
const THUMBNAILS = 5;

/**
 * `ModDetails` while the list's mods load: its tab and button, picture and thumbnails, stats,
 * author and pills, and description, pulsing. Each pulses on its own, as the description's skeleton does.
 */
export const ModDetailsSkeleton = () => (
  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-y-3 overflow-hidden p-6">
    <div className="flex animate-pulse items-center justify-between gap-x-4">
      <div className="h-8 w-20 rounded-sm bg-surface-translucent-mid" />

      <div className="size-8 rounded-sm bg-surface-translucent-mid" />
    </div>

    <div className="flex animate-pulse flex-col gap-y-2">
      <div className="aspect-mod w-full rounded-sm bg-surface-translucent-mid" />

      <div className="flex gap-x-1.5">
        {Array.from({ length: THUMBNAILS }, (_, index) => (
          <div className="aspect-mod flex-1 rounded-xs bg-surface-translucent-mid" key={index} />
        ))}
      </div>
    </div>

    <div className="@container border-y border-stroke-weak py-4">
      <div className="grid grid-cols-3 gap-2 @2xl:grid-cols-6">
        {Array.from({ length: STATS }, (_, index) => (
          <div className="flex animate-pulse flex-col gap-y-1.5 justify-self-center" key={index}>
            <div className="h-3 w-16 rounded-sm bg-surface-translucent-mid" />

            <div className="h-4 w-12 rounded-sm bg-surface-translucent-mid" />
          </div>
        ))}
      </div>
    </div>

    <div className="flex animate-pulse items-center gap-2">
      <div className="h-5.5 w-28 rounded-sm bg-surface-translucent-mid" />

      <div className="h-5.5 w-16 rounded-full bg-surface-translucent-mid" />

      <div className="h-5.5 w-20 rounded-full bg-surface-translucent-mid" />
    </div>

    <div className="pt-6">
      <ModDetailsDescriptionSkeleton />
    </div>
  </div>
);
