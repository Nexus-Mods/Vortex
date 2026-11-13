import React from "react";

export default function ModComboboxSkeletonTile() {
  const tile = (
    <div className="flex animate-pulse items-center gap-4 space-y-1 rounded-sm bg-surface-high p-1 px-2">
      <div className="h-5 w-10 bg-surface-mid" />

      <div className="h-3 w-3/4 rounded-sm bg-surface-mid" />
    </div>
  );

  const tiles: React.JSX.Element[] = Array.from({ length: 3 }).fill(tile) as React.JSX.Element[];

  return <div className="flex flex-col gap-0.5 py-1">{tiles}</div>;
}
