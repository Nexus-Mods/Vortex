import React from "react";

export default function FloatingSearchBarSkeletonTile() {
  // return (
  //   <div className="animate-pulse space-y-2.5 rounded-sm bg-surface-high p-4">
  //     <div className="h-4 w-1/4 rounded-sm bg-surface-mid" />

  //     <div className="h-3 w-1/2 rounded-sm bg-surface-mid" />
  //   </div>
  // );

  return (
    <div className="flex animate-pulse gap-2 overflow-hidden px-2 py-1 hover:bg-surface-mid">
      <div className="aspect-mod h-16 w-24 rounded-sm" />

      <div className="line-clamp-2 h-3 w-1/2" />
    </div>
  );
}
