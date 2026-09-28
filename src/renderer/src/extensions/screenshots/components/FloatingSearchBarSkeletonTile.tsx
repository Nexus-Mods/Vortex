import React from "react";

export default function FloatingSearchBarSkeletonTile() {
  return (
    <div className="flex animate-pulse gap-2 overflow-hidden px-2 py-1 hover:bg-surface-mid">
      <div className="aspect-mod h-16 w-24 rounded-sm" />

      <div className="line-clamp-2 h-3 w-1/2" />
    </div>
  );
}
