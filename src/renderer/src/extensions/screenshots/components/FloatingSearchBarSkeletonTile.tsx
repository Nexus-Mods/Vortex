import React from "react";

export default function FloatingSearchBarSkeletonTile() {
  return (
    <div className="animate-pulse space-y-2.5 rounded-sm bg-surface-high p-4">
      <div className="h-4 w-1/4 rounded-sm bg-surface-mid" />

      <div className="h-3 w-1/2 rounded-sm bg-surface-mid" />
    </div>
  );
}
